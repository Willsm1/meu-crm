# Taurus Magnum Regression Contract

A release is acceptable only if all ten invariants below remain true:

1. WhatsApp session pairs/connects.
2. Linked number is visible after connection.
3. Inbound text persists.
4. Outbound mobile/linked-device text persists.
5. Follow-up reflects persisted interactions according to its semantics.
6. Images persist and can be retrieved.
7. Audio persists and can be retrieved.
8. Existing conversation history remains queryable.
9. Observer and gateway processing is idempotent.
10. Tests do not mutate existing production client/history data.

The contract is split into four independent domains: CRM/Follow-up, WhatsApp realtime, Media, and History/catch-up. A change in one domain must run the suites for all domains before merge.
