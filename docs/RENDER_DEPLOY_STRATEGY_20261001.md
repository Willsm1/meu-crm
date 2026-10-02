# Render deploy strategy

The Render WhatsApp gateway must deploy code approved on `main`.

Current safe operating rule:

1. `main` is the only functional source of truth.
2. `release/taurus-magnum-rc-20261001` may exist only as a deploy pointer and must be kept at the same approved commit as `main`.
3. Before any forced sync of the deploy branch, create a backup branch at its previous head.
4. Never merge the old divergent release history back into `main`.
5. Baileys auth/media runtime data must live under `TAURUS_DATA_ROOT` on a persistent host disk.
