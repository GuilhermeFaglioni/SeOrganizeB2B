# Issue 160 Build Baseline

On 2026-08-19, the build was run without URL environment variables:

```sh
env -u NEXT_PUBLIC_APP_URL -u APP_URL npm run build
```

It compiled successfully and then failed while collecting page data for `/_not-found` because `NEXT_PUBLIC_APP_URL or APP_URL is required in production`. This is the pre-existing configuration baseline; the same build passes when the required URL variables are supplied.
