import { parseCommand } from './command.js';
import { showDiffForFile } from './diff.js';
import { getCommitRange, getTargetStatus } from './status.js';

async function main() {
	const command = parseCommand();

	const targetStatus = await getTargetStatus(command);
	const commitRange = await getCommitRange(targetStatus);

	await showDiffForFile(targetStatus.sourceFile, commitRange.from);

	/*
BRANCH_SLUG="i18n/$(echo "$TARGET_FILE" | iconv -t ascii//TRANSLIT | sed -r s/[^a-zA-Z0-9]+/-/g | sed -r s/^-+\|-+$//g | tr A-Z a-z)"

echo "Branch slug: $BRANCH_SLUG"

git checkout main || true

git branch -D "$BRANCH_SLUG" || true

git checkout -b "$BRANCH_SLUG" main

git diff --find-renames "$LATEST_TRANSLATED_COMMIT...HEAD" -- "$ORIGINAL_FILE"

git add "$TRANSLATED_FILE"

git commit -m "i18n($TARGET_LANGUAGE): Update \`$TARGET_FILE\`" -- "$TRANSLATED_FILE"

git push --set-upstream origin "$BRANCH_SLUG"
  */
}

process.setSourceMapsEnabled(true);

main().catch((error) => {
	// eslint-disable-next-line no-console
	console.error(error);

	process.exit(1);
});
