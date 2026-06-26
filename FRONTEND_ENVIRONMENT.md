# Frontend Environment

Deploy-facing public variables for the Profixter frontend.

```bash
NEXT_PUBLIC_API_URL=https://api.profixter.com
```

For local development, point it at the local backend port:

```bash
NEXT_PUBLIC_API_URL=http://localhost:5000
```

Do not add backend secrets, Stripe secrets, OpenAI keys, AWS keys, or SMTP credentials to the frontend environment.
