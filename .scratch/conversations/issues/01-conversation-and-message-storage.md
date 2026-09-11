# 01: Conversation and Message — contract, schema, repository

**What to build:** The two new tables, their contract types, and the repository
module that is the only thing allowed to query them. Nothing user-facing.

**Blocked by:** —

**Status:** ready-for-agent

- [ ] `Conversation` and `Message` added to `packages/schema`: a Conversation carries its user, a nullable Job Application id and timestamps; a Message carries its Conversation, a `role` of `user` or `model`, its text, and when it was said
- [ ] `role` is a closed set in the contract, in the same style as `JobStatus` and `Necessity`, with the database enum derived from it rather than retyped
- [ ] Both tables carry `user_id`, as every table does (ADR-0001)
- [ ] A partial unique index on `(user_id)` where `job_application_id is null`, and a unique index on `(user_id, job_application_id)` — "two kinds and no more" enforced by the database, not by a comment
- [ ] Deleting a Job Application deletes its Conversation and that Conversation's Messages
- [ ] `apps/web/lib/conversations/repository.ts` is the only module building these queries, every function taking the owner's id as a non-optional first argument (ADR-0001)
- [ ] It can: find or create a Conversation for a scope, read its Messages oldest-first, append one Message, and clear a Conversation's Messages while keeping the row
- [ ] Clearing and deleting are distinct operations with distinct functions — clearing empties, deleting removes
- [ ] Migration generated and checked in
- [ ] No staleness column and no marker of what a Conversation was assembled against; the reasoning is in `CONTEXT.md` and must not be quietly reintroduced
- [ ] Uses the vocabulary in `CONTEXT.md` throughout
