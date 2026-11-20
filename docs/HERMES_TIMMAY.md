# Hermes on TIMMAY

Hermes Agent is Tim's local agent on his PC TIMMAY. This page tells every AI on Forge where its setup lives and how it reaches Tim's Gmail. Set up by Claude on Nov 20, 2026. Full plan: the "Hermes setup plan" Claude Doc in Tim's account.

This repo is public, so this page lists file paths only. No password, key or token value goes here or anywhere else in Forge.

## Where things live on TIMMAY
| What | Path |
|---|---|
| Hermes home (config.yaml, SOUL.md, skills) | `C:\Users\Tim\AppData\Local\hermes` |
| Context file (job-search notes, IP rules) | `C:\Users\Tim\My Drive\Hermes_Workspace\HERMES.md` |
| Logon script (warms models, starts gateway and office poller) | `D:\Ollama\start_hermes_stack.ps1` |
| Office poller (answers 3D office chat directly) | `D:\Hermes\office\hermes-office-poller.ps1` |

Default model: mimo-v2.6 9B on the GPU. Fallback qwen3.5 9B, then ministral-3 3B on CPU. Gemini is a manual alias only.

## Gmail access (the one credential Hermes uses)
- **Credential file:** `C:\Users\Tim\.hermes\gmail_app_password.json`, keys `email` and `password`. It holds a Google app password for Tim's Gmail.
- **Used by:**
  - `skills\career\tim-job-research` (morning job report sent over SMTP)
  - `skills\career\applicationstatus` (application status from the inbox over IMAP, read-only)
- **Rule:** code loads the password from that file at run time. The value is never typed into a skill, prompt, log, receipt, handoff, doc or chat. To rotate it, replace the value in that one file.
- **Checked Nov 20, 2026:** a read-only IMAP login through the file worked.
- **Calendar:** Hermes has no calendar access yet.

## Old copies to clean up
Before Nov 20 an older app password was typed into the job-research skill. It still works until Tim deletes it in his Google account (Security, App passwords). Copies of that old value remain in Hermes's backup and reference files under `skills\career\tim-job-research` and `skills\research\job-research\references`. They stop mattering once that old app password is deleted.
