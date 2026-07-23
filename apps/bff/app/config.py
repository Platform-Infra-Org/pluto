from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App configuration, populated from environment variables only."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/bff"
    log_level: str = "INFO"
    cors_allowed_origins: str = "http://localhost:5173"
    app_base_url: str = "http://localhost:5173"
    bff_base_url: str = "http://localhost:8000"

    # OIDC / Keycloak. Defaults are test-only placeholders; real values come from env.
    oidc_issuer_url: str = "https://keycloak.example.com/realms/platform"
    oidc_client_id_spa: str = "platform-spa"
    oidc_client_id_bff: str = "platform-bff"
    oidc_client_secret_bff: str = "change-me"
    oidc_groups_claim: str = "groups"
    session_secret: str = "change-me-session-secret"

    # Argo Workflows API (E03). Real token/URL come from env; defaults are test-only.
    # Empty ARGO_SERVER_URL means "no cluster wired" — integration tests skip on it.
    argo_server_url: str = ""
    argo_namespace: str = "platform"
    argo_auth_token: str = ""
    argo_verify_tls: bool = True

    # Git resource catalog (E04). Repo is read-only from the app. Secrets from env.
    git_repo_url: str = ""
    git_branch: str = "main"
    git_read_token: str = ""
    git_webhook_secret: str = ""
    git_cache_dir: str = ".catalog-cache"
    # Ownership fallbacks when metadata.ownerTeam is absent: git-path prefix -> team, then default.
    ownership_path_map: dict[str, str] = {}
    default_owner_team: str = "platform"

    # group-name -> {roles: [...], teams: [...], deny: [...]}. Config-driven (JSON in env),
    # never hardcoding a real customer's directory groups. Sane default for tests only.
    role_group_map: dict[str, dict[str, list[str]]] = {
        "platform-admins": {"roles": ["platform-admin"]},
        "requesters": {"roles": ["requester"]},
        "auditors": {"roles": ["auditor"]},
        "owners-payments": {"teams": ["payments"]},
        "owners-search": {"teams": ["search"]},
    }

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.cors_allowed_origins.split(",") if o.strip()]


settings = Settings()
