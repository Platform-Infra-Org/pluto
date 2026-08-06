{{- define "platform.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "platform.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name (include "platform.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}

{{- define "platform.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
{{ include "platform.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "platform.selectorLabels" -}}
app.kubernetes.io/name: {{ include "platform.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "platform.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "platform.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{- define "platform.baseUrl" -}}
{{- printf "%s://%s" (ternary "https" "http" .Values.ingress.tls.enabled) .Values.ingress.host -}}
{{- end -}}

{{/*
One env entry per credential, all from the same Secret. Kept in a helper so the
Deployment and any job that needs the same environment cannot drift apart.
*/}}
{{- define "platform.secretEnv" -}}
{{- $s := .Values.secrets -}}
{{- range $var, $key := dict
  "POSTGRES_PASSWORD"    $s.keys.postgresPassword
  "OIDC_CLIENT_SECRET"   $s.keys.oidcClientSecret
  "AUTH_SESSION_SECRET"  $s.keys.authSessionSecret
  "LDAP_BIND_SECRET"     $s.keys.ldapBindSecret
  "BITBUCKET_TOKEN"      $s.keys.bitbucketToken
  "ARGO_TOKEN"           $s.keys.argoToken
  "PLATFORM_SECRET_KEY"  $s.keys.platformSecretKey }}
- name: {{ $var }}
  valueFrom:
    secretKeyRef:
      name: {{ $s.existingSecret }}
      key: {{ $key }}
{{- end }}
{{- end -}}
