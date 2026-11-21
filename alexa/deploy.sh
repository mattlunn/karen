#!/usr/bin/env bash
set -euo pipefail

: "${ALEXA_SKILL_ID:?}" "${SKILL_NAME:?}" "${CUSTOM_ENDPOINT_URI:?}" "${SMART_HOME_LAMBDA_ARN:?}"

cd "$(dirname "$0")/skill-package"

wait_for() {
  local resource=$1 path=$2 status

  for _ in $(seq 1 60); do
    status=$(ask smapi get-skill-status -s "$ALEXA_SKILL_ID" --resource "$resource")
    case $(jq -r "$path.lastUpdateRequest.status" <<< "$status") in
      SUCCEEDED) return 0 ;;
      FAILED) jq "$path.lastUpdateRequest" <<< "$status"; return 1 ;;
    esac
    sleep 5
  done

  echo "Timed out waiting for $resource to update"
  return 1
}

manifest=$(mktemp)

jq 'walk(if type == "string" then gsub("\\$\\{(?<name>[A-Z_]+)\\}"; $ENV[.name]) else . end)' skill.json > "$manifest"
ask smapi update-skill-manifest -s "$ALEXA_SKILL_ID" -g development --manifest "file:$manifest"
wait_for manifest '.manifest'
echo "Manifest updated"

for model in interactionModels/custom/*.json; do
  locale=$(basename "$model" .json)

  ask smapi set-interaction-model -s "$ALEXA_SKILL_ID" -g development -l "$locale" --interaction-model "file:$model"
  wait_for interactionModel ".interactionModel[\"$locale\"]"
  echo "Interaction model for $locale built"
done
