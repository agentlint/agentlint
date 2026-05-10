# Cloudflare DNS records for `agentlint.sh`

> Apply these at Cloudflare → `agentlint.sh` zone → DNS → Records.
>
> **Critical:** set every record's proxy to **DNS only** (gray cloud).
> Orange-cloud (proxied) breaks Vercel's edge cert and TLS handshake.

## Records

| Type | Name | Content | Proxy | TTL |
|---|---|---|---|---|
| `A` | `@` | `216.198.79.1` | DNS only | Auto |
| `CNAME` | `www` | `cname.vercel-dns.com.` | DNS only | Auto |

That's all. Vercel verifies automatically once the records resolve and
provisions the TLS cert within a couple of minutes. The
`agentlint.sh` and `www.agentlint.sh` domains are already added on the
Vercel side.

## Why these specific values

- The `A` record uses the IP Vercel currently lists as `recommendedIPv4
  rank: 1` for this account/region (`216.198.79.1`). If the IP rotates
  in the future Vercel surfaces a notice on the project's Domains page.
- `cname.vercel-dns.com.` is the universal Vercel CNAME target.
  Cloudflare flattens CNAMEs so it resolves transparently; if
  preferred, the apex can also use a flattened CNAME pointing to the
  same target.

## How to verify

```bash
dig +short agentlint.sh
# expect: 216.198.79.1

dig +short www.agentlint.sh
# expect: a Vercel-owned CNAME chain ending in an IP

curl -I https://agentlint.sh
# expect: HTTP/2 200 served by Vercel
```

If `agentlint.sh/api/stripe/webhook` returns 200 once DNS is live,
Stripe webhooks (configured during the overnight build) will start
reaching the app on the first event.
