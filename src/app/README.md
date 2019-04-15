## Description
This directory is for serving config values to UI layer apps like the qiibee Mobile and Web wallets.

---

### List of Routes:

- GET `/app/infura`
> returns an encrypted infura API key that is decrypted with a secret key hardcoded in the wallet app

Response format:
```
{
  key: '<encrypted key here>'
}
```
