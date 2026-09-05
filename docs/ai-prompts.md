# AI prompts

I used AI as a support tool while working on the project. I mainly used it to structure the application building process, understand the code, solve deployment problems, debug errors, and prepare the documentation.

## Understanding the existing project

### Prompt

“Review this restaurant orders project and explain how the frontend, backend, database, authentication, and order flow are connected.”

### What I got

I received an explanation of the project structure and how the React frontend communicates with the Express backend. It also helped me understand how Prisma connects the backend to the PostgreSQL database.

### What I corrected

I checked the explanation against the actual files in the project. Whenever the explanation did not match the code, I followed the provided documents rather than coding unnecessary features.

## Planning the deployment

### Prompt

“How can I deploy this React frontend, Express backend, and PostgreSQL database online using Vercel, Render, and Supabase?”

### What I got

I received a deployment plan:

1. Host the PostgreSQL database using Supabase.
2. Deploy the Express backend using Render.
3. Deploy the React frontend using Vercel.
4. Add the correct environment variables.
5. Update the frontend to use the deployed backend URL.

### What I corrected

I had to adjust the instructions to match the actual project structure and deployment settings. I also checked that the frontend used the correct Render backend URL. The Environment Variables were also as important.

## Fixing the Prisma deployment error

### Prompt

“Render is failing during deployment because the Prisma client is missing. How should I fix the build command?”

### What I got

The suggested solution was to generate the Prisma client during the Render build process.

### What I corrected

I changed the Render build command to:

```bash
npm install && npx prisma generate

## Git and project history

### Prompt

“How should I safely apply a small authentication fix without creating unnecessary branches or changing too many files?”

### What I got

The AI suggested making the smallest possible change, checking the Git status, committing the change, and pushing it to the main branch.

### What I corrected

I first created a temporary branch while testing the fix. Later, I removed the extra branch and kept the final change on the main branch so that the repository history remained simple.

## Documentation

### Prompt

“Help me write the project documentation in simple human language based on what I actually built.”

### What I got

The AI helped organise the documentation into:

- Architecture
- Database schema
- Development plan
- Technical decisions
- AI prompts used during development

### What I corrected

I made sure the documentation described the actual project and deployment process instead of adding features that were not implemented. I also included the problems I faced during deployment and the fixes I applied.

## Git and project history

### Prompt

“How should I safely apply a small authentication fix without creating unnecessary branches or changing too many files?”

### What I got

The AI suggested making the smallest possible change, checking the Git status, committing the change, and pushing it to the main branch.

### What I corrected

I first created a temporary branch while testing the fix. Later, I removed the extra branch and kept the final change on the main branch so that the repository history remained simple.

## Documentation

### Prompt

“Help me write the project documentation in simple human language based on what I actually built.”

### What I got

The AI helped organize the documentation into:

- Architecture
- Database schema
- Development plan
- Technical decisions
- AI prompts used during development

### What I corrected

I made sure the documentation described the actual project and deployment process instead of adding features that were not implemented. I also included the problems I faced during deployment and the fixes I applied.
