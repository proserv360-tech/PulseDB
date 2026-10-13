# FATHOM SDK OpenAPI Specification

This directory contains the **source of truth** for FATHOM SDK wire formats and contracts across all client implementations:

- **JavaScript SDK**
- **Python SDK**
- **Go SDK**
- **Java SDK** (future)

## Overview

`fathom-sdk.yaml` is an OpenAPI 3.0.3 specification that defines:

1. **Three public endpoints**:
    - `POST /api/sdk/ingest` — batch event ingest with authentication
    - `POST /api/sdk/heartbeat` — SDK liveness pulse with authentication
    - `GET /api/sdk/health` — public health probe (no auth)

2. **Request/response schemas**:
    - Base `SdkEvent` schema with required fields: `type`, `title`, `severity`, `timestamp`
    - Four canonical event type variants: `ApiCallEvent`, `ErrorEvent`, `AuditEvent`, `MetricEvent`
    - Each variant includes typed metadata fields for SDK code generation

3. **Authentication**:
    - API key security scheme: `X-SDK-Key: sk_live_<...>` header
    - Applied to `/ingest` and `/heartbeat` endpoints

4. **Error handling**:
    - 400: validation errors
    - 401: authentication failures
    - 500: server errors

## Regenerating SDK Clients

To regenerate typed client code from this spec, use OpenAPI Generator:

```bash
openapi-generator-cli generate \
  -i fathom-sdk.yaml \
  -g javascript \
  -o ../clients/javascript

openapi-generator-cli generate \
  -i fathom-sdk.yaml \
  -g python \
  -o ../clients/python

openapi-generator-cli generate \
  -i fathom-sdk.yaml \
  -g go \
  -o ../clients/go
```

Adjust the `-g` (generator) flag and `-o` (output path) for each language.

## Wire Contract Policy

**Any change to the SDK wire contract MUST:**

1. Update `fathom-sdk.yaml` first
2. Validate the spec with `openapi-spec-validator fathom-sdk.yaml`
3. Regenerate typed clients for all SDKs
4. Only then update SDK implementations

**Breaking changes** (removing fields, changing required status, altering enum values) require a new API version; semantic versioning applies.

## Validation

Ensure the spec is valid before committing:

```bash
pip install openapi-spec-validator
openapi-spec-validator fathom-sdk.yaml
```

Or, minimal YAML check:

```bash
python3 -c "import yaml; yaml.safe_load(open('fathom-sdk.yaml'))"
```

## Specification Design Notes

- **Batch events**: Up to 100 events per `/ingest` request for efficiency
- **Timestamps**: All timestamps are RFC 3339 format (ISO 8601)
- **Metadata**: Event metadata uses `additionalProperties: true` for flexibility; canonical event types define common fields
- **Security**: Single `SdkKey` scheme supports future key rotation and revocation policies
- **Health**: Public `/health` endpoint allows infrastructure monitoring without SDK credentials
