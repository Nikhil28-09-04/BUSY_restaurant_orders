# Plan

### How did you break the work into sessions?

I divided the work into small sessions instead of trying to complete everything at once. I first understood the assignment. Then I worked on the application features, database, authentication, and deployment. After that, I spent separate sessions testing the application and fixing the problems found during deployment. I kept the documentation for the end so I could describe what I actually built.

### What order did you build in, and why that order?

I started by understanding the existing project. I then checked the database and backend, since the frontend depends on the API and stored data. After that, I worked on authentication, menu and order functionality, and dashboard features. Once the application worked locally, I deployed the backend first and the frontend second. This order made sense because the frontend needed a working backend URL. Finally, I tested the deployed application and fixed issues such as Prisma generation, CORS, and authentication cookies.

### What did you estimate versus what it actually took?

The assignment suggested an effort of approximately 12 hours. I initially expected the work to take around that amount of time, with most of the time spent understanding the code and completing the main features. In reality, much more time was needed for testing and deployment. Configuring Supabase, Render, and Vercel and fixing the communication and authentication issues also took significant time. The deployment and debugging took longer than I originally expected.

### What did you cut when you ran short?

When I ran short on time, I focused on making the main application workflows work rather than adding more optional features. I focused on authentication, menu and order management, dashboard functionality, database persistence, and deployment. I did not spend extra time on major UI designs or additional features that were not necessary for the core requirements. I also kept the documentation focused on the actual implementation and the important technical decisions.
