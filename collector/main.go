// Fast parallel Blockscout / Basescan collector for wallet history legs.
// Usage: collector <address> [--pages=N]
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	blockscoutV1 = "https://base.blockscout.com/api"
	etherscanV2  = "https://api.etherscan.io/v2/api"
	baseChainID  = "8453"
)

type Transfer struct {
	Hash     string  `json:"hash"`
	Category string  `json:"category"`
	Value    float64 `json:"value"`
	Asset    string  `json:"asset"`
	From     string  `json:"from"`
	To       string  `json:"to"`
	Metadata struct {
		BlockTimestamp      string `json:"blockTimestamp"`
		WalletParticipated  bool   `json:"walletParticipated"`
	} `json:"metadata"`
}

type Output struct {
	Transfers  []Transfer `json:"transfers"`
	NftLegs    int        `json:"nftLegs"`
	NftTxCount int        `json:"nftTxCount"`
	Source     string     `json:"source"`
	ElapsedMs  int64      `json:"elapsedMs"`
}

type rawTx struct {
	Hash            string `json:"hash"`
	TimeStamp       string `json:"timeStamp"`
	From            string `json:"from"`
	To              string `json:"to"`
	Value           string `json:"value"`
	TokenID         string `json:"tokenID"`
	ContractAddress string `json:"contractAddress"`
	TokenSymbol     string `json:"tokenSymbol"`
	TokenDecimal    string `json:"tokenDecimal"`
}

type apiResp struct {
	Status  string      `json:"status"`
	Message string      `json:"message"`
	Result  interface{} `json:"result"`
}

var client = &http.Client{Timeout: 14 * time.Second}

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "usage: collector <address> [--pages=N]")
		os.Exit(2)
	}
	addr := strings.ToLower(strings.TrimSpace(os.Args[1]))
	if !strings.HasPrefix(addr, "0x") || len(addr) != 42 {
		fmt.Fprintln(os.Stderr, "invalid address")
		os.Exit(2)
	}
	pages := 4
	for _, a := range os.Args[2:] {
		if strings.HasPrefix(a, "--pages=") {
			if n, err := strconv.Atoi(strings.TrimPrefix(a, "--pages=")); err == nil && n > 0 {
				pages = n
			}
		}
	}

	start := time.Now()
	out := collect(addr, pages)
	out.ElapsedMs = time.Since(start).Milliseconds()
	enc := json.NewEncoder(os.Stdout)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(out)
}

func collect(addr string, pages int) Output {
	var (
		mu        sync.Mutex
		transfers []Transfer
		nftHashes = map[string]struct{}{}
		wg        sync.WaitGroup
	)
	basescanKey := strings.TrimSpace(os.Getenv("BASESCAN_API_KEY"))
	if basescanKey == "" {
		basescanKey = strings.TrimSpace(os.Getenv("NEXT_PUBLIC_BASESCAN_API_KEY"))
	}

	type job struct {
		host   string
		action string
		page   int
		key    string
	}
	var jobs []job

	for p := 1; p <= pages; p++ {
		jobs = append(jobs, job{host: "blockscout", action: "tokennfttx", page: p})
	}
	for p := 1; p <= min(pages, 3); p++ {
		jobs = append(jobs, job{host: "blockscout", action: "tokentx", page: p})
		jobs = append(jobs, job{host: "blockscout", action: "txlistinternal", page: p})
	}
	jobs = append(jobs, job{host: "blockscout", action: "txlist", page: 1})

	if basescanKey != "" {
		for p := 1; p <= min(pages, 2); p++ {
			jobs = append(jobs, job{host: "basescan", action: "tokennfttx", page: p, key: basescanKey})
		}
	}

	sem := make(chan struct{}, 12)
	for _, j := range jobs {
		wg.Add(1)
		go func(j job) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			rows := fetchPage(j, addr)
			if len(rows) == 0 {
				return
			}
			legs := mapRows(j.action, rows)
			mu.Lock()
			transfers = append(transfers, legs...)
			for _, t := range legs {
				if t.Category == "erc721" || t.Category == "erc1155" {
					nftHashes[t.Hash] = struct{}{}
				}
			}
			mu.Unlock()
		}(j)
	}
	wg.Wait()

	return Output{
		Transfers:  transfers,
		NftLegs:    len(transfers),
		NftTxCount: len(nftHashes),
		Source:     "go-collector",
	}
}

func fetchPage(j job, addr string) []rawTx {
	var url string
	switch j.host {
	case "blockscout":
		url = fmt.Sprintf("%s?module=account&action=%s&address=%s&startblock=0&endblock=99999999&page=%d&offset=10000&sort=desc",
			blockscoutV1, j.action, addr, j.page)
	case "basescan":
		url = fmt.Sprintf("%s?chainid=%s&module=account&action=%s&address=%s&startblock=0&endblock=99999999&page=%d&offset=10000&sort=desc&apikey=%s",
			etherscanV2, baseChainID, j.action, addr, j.page, j.key)
	default:
		return nil
	}

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil
	}
	req.Header.Set("User-Agent", "BaseAnalyticsCollector/1.0")

	res, err := client.Do(req)
	if err != nil {
		return nil
	}
	defer res.Body.Close()
	body, err := io.ReadAll(io.LimitReader(res.Body, 8<<20))
	if err != nil {
		return nil
	}

	var data apiResp
	if err := json.Unmarshal(body, &data); err != nil {
		return nil
	}
	if data.Status != "1" {
		return nil
	}
	arr, ok := data.Result.([]interface{})
	if !ok || len(arr) == 0 {
		return nil
	}
	if _, isStr := arr[0].(string); isStr {
		return nil
	}
	raw, err := json.Marshal(arr)
	if err != nil {
		return nil
	}
	var rows []rawTx
	if err := json.Unmarshal(raw, &rows); err != nil {
		return nil
	}
	return rows
}

func mapRows(action string, rows []rawTx) []Transfer {
	out := make([]Transfer, 0, len(rows))
	for _, tx := range rows {
		t := Transfer{
			Hash: strings.ToLower(tx.Hash),
			From: strings.ToLower(tx.From),
			To:   strings.ToLower(tx.To),
		}
		t.Metadata.WalletParticipated = true
		if ts, err := strconv.ParseInt(tx.TimeStamp, 10, 64); err == nil && ts > 0 {
			t.Metadata.BlockTimestamp = time.Unix(ts, 0).UTC().Format(time.RFC3339)
		} else {
			continue
		}

		switch action {
		case "tokennfttx":
			t.Category = "erc721"
			t.Value = 1
			contract := strings.ToLower(tx.ContractAddress)
			tokenID := tx.TokenID
			if tokenID == "" {
				tokenID = "0"
			}
			if contract != "" {
				t.Asset = contract + "#" + tokenID
			} else {
				t.Asset = "unknown"
			}
		case "tokentx":
			t.Category = "erc20"
			decimals, _ := strconv.Atoi(tx.TokenDecimal)
			if decimals <= 0 {
				decimals = 18
			}
			raw, _ := strconv.ParseFloat(tx.Value, 64)
			div := 1.0
			for i := 0; i < decimals; i++ {
				div *= 10
			}
			t.Value = raw / div
			if tx.TokenSymbol != "" {
				t.Asset = tx.TokenSymbol
			} else {
				t.Asset = "TOKEN"
			}
		case "txlistinternal", "txlist":
			if action == "txlistinternal" {
				t.Category = "internal"
			} else {
				t.Category = "external"
			}
			t.Asset = "ETH"
			if tx.Value != "" {
				wei := new(big.Float)
				if _, ok := wei.SetString(tx.Value); ok {
					eth := new(big.Float).Quo(wei, big.NewFloat(1e18))
					f, _ := eth.Float64()
					t.Value = f
				}
			}
		default:
			continue
		}
		out = append(out, t)
	}
	return out
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
