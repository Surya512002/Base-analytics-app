"use client";

import { useEffect, useState } from "react";
import { Megaphone, Send } from "lucide-react";
import type { LaunchedToken, TokenAnnouncement } from "@/lib/launchpad/types";
import { fetchAnnouncements, postAnnouncement } from "@/lib/api/launchpad-client";
import { timeAgo } from "@/lib/launchpad/format";

export default function TokenAnnouncementsPanel({
  token,
  walletAddress,
  showToast,
}: {
  token: LaunchedToken;
  walletAddress?: string;
  showToast: (msg: string, hash: string) => void;
}) {
  const [announcements, setAnnouncements] = useState<TokenAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  const isCreator =
    walletAddress &&
    walletAddress.toLowerCase() === token.creator.toLowerCase();

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void fetchAnnouncements(token.address)
      .then((list) => {
        if (!alive) return;
        setAnnouncements(list);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [token.address]);

  const onPost = async () => {
    if (!walletAddress || !body.trim()) return;
    setPosting(true);
    try {
      const result = await postAnnouncement(token.address, walletAddress, body.trim());
      if (!result.ok) {
        showToast(result.error ?? "Failed to post announcement", "");
        return;
      }
      setAnnouncements(result.announcements ?? []);
      setBody("");
      showToast("Announcement posted", "");
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-2)] p-5">
      <div className="flex items-center gap-2 mb-4">
        <Megaphone size={16} className="text-[var(--ink-muted)]" />
        <p className="text-sm font-black text-[var(--ink)]">Creator announcements</p>
      </div>

      {isCreator && (
        <div className="mb-4 space-y-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 500))}
            placeholder="Share an update with your community…"
            rows={3}
            className="w-full input-ink rounded-xl px-3 py-2.5 text-sm resize-none"
          />
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--ink-dim)]">{body.length}/500</span>
            <button
              type="button"
              onClick={() => void onPost()}
              disabled={posting || !body.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[11px] font-bold bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white disabled:opacity-40"
            >
              <Send size={12} />
              {posting ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-[11px] text-[var(--ink-dim)]">Loading announcements…</p>
      ) : announcements.length === 0 ? (
        <p className="text-[11px] text-[var(--ink-dim)]">
          {isCreator
            ? "No announcements yet — post your first update above."
            : "No announcements from the creator yet."}
        </p>
      ) : (
        <ul className="space-y-3">
          {announcements.map((a) => (
            <li
              key={a.id}
              className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-2)] px-4 py-3"
            >
              <p className="text-[11px] text-[var(--ink-muted)] leading-relaxed whitespace-pre-wrap">
                {a.body}
              </p>
              <p className="text-[9px] text-[var(--ink-dim)] mt-2">{timeAgo(a.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
