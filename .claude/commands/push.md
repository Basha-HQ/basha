Run the full git stage → commit → push workflow:

1. Run `git status` and `git diff HEAD` in parallel to see what has changed (staged and unstaged).

2. Analyze all changes and draft a commit message:
   - Use imperative present tense (e.g. "Add speaker identification to manual upload pipeline")
   - Be specific — summarize the actual changes, not generic filler
   - Keep the subject line under 72 characters
   - If changes span multiple concerns, use a short body paragraph after a blank line

3. Stage all modified and new tracked files:
   ```
   git add -A
   ```
   Do NOT stage files that likely contain secrets (.env, *.key, *.pem, credentials.*).
   Warn the user if any such files are detected in the diff.

4. Commit with the drafted message, appending the Co-Authored-By trailer:
   ```
   git commit -m "$(cat <<'EOF'
   <your commit message here>

   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
   EOF
   )"
   ```

5. Push to the current branch's upstream remote:
   ```
   git push
   ```
   If no upstream is set, run `git push --set-upstream origin <current-branch>` instead.

6. Confirm success by showing the final `git status` output and the remote URL pushed to.
