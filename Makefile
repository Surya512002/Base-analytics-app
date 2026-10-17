.PHONY: all verify test typecheck lint build audit secrets fork deploy-dry-run

all: verify

typecheck:
	npx tsc --noEmit

lint:
	npm run lint

test:
	npx vitest run

audit:
	npm audit --omit=dev

secrets:
	node scripts/scan-secrets.mjs

fork:
	npx vitest run test/fork/mainnet-fork.test.ts

build:
	npm run build

deploy-dry-run:
	node scripts/deploy-contracts.mjs --dry-run

verify: typecheck lint audit secrets test fork
	@echo "All release readiness checks passed successfully!"
