# Production database

For production, Rujula Shop uses PostgreSQL through the `DATABASE_URL` environment variable.

The included Render Blueprint creates a PostgreSQL database and injects its connection string into the FastAPI service.

Local development can continue to use SQLite via:

```text
DATABASE_URL=sqlite:///./rujula.db
```

For a production ecommerce system, keep the database managed by the hosting provider and back it up regularly.
