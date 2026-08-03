# How-to: rotate the API credentials

An example page — the kind of task documentation that only makes sense for
*our* deployment of a vendor application.

1. Mint a new key in the vendor console.
2. Update the platform secret:

    ```bash
    kubectl -n billing create secret generic acme-billing-api \
      --from-literal=key=<new> --dry-run=client -o yaml | kubectl apply -f -
    ```

3. Roll the deployment and confirm the health endpoint returns 200.
4. Revoke the old key once traffic has drained.
