-- ============================================================
--  DevNest Academy — Complete Database Seed
--  Fictional online course platform for EduAgent
-- ============================================================

-- ─────────────────────────────────────────────
--  EXTENSIONS
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";


-- ─────────────────────────────────────────────
--  TABLES
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS instructors (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    title           TEXT,
    bio             TEXT,
    expertise       TEXT[],
    linkedin        TEXT,
    rating          NUMERIC(3,2),
    total_students  INT DEFAULT 0,
    avatar_url      TEXT
);

CREATE TABLE IF NOT EXISTS categories (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    slug        TEXT NOT NULL UNIQUE,
    description TEXT,
    icon        TEXT
);

CREATE TABLE IF NOT EXISTS courses (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title               TEXT NOT NULL,
    slug                TEXT NOT NULL UNIQUE,
    category_id         INT REFERENCES categories(id),
    instructor_id       UUID REFERENCES instructors(id),
    short_description   TEXT,
    full_description    TEXT,
    level               TEXT CHECK (level IN ('Beginner','Intermediate','Advanced')),
    duration_weeks      INT,
    hours_per_week      INT,
    total_hours         INT GENERATED ALWAYS AS (duration_weeks * hours_per_week) STORED,
    price_usd           NUMERIC(8,2),
    discounted_price    NUMERIC(8,2),
    language            TEXT DEFAULT 'English',
    prerequisites       TEXT[],
    skills_gained       TEXT[],
    certificate         BOOLEAN DEFAULT TRUE,
    is_live             BOOLEAN DEFAULT FALSE,
    is_featured         BOOLEAN DEFAULT FALSE,
    enrollment_open     BOOLEAN DEFAULT TRUE,
    next_cohort_start   DATE,
    rating              NUMERIC(3,2),
    total_reviews       INT DEFAULT 0,
    total_enrolled      INT DEFAULT 0,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    embedding           VECTOR(384)
);

CREATE TABLE IF NOT EXISTS course_modules (
    id          SERIAL PRIMARY KEY,
    course_id   UUID REFERENCES courses(id) ON DELETE CASCADE,
    module_no   INT,
    title       TEXT NOT NULL,
    description TEXT,
    duration_hr NUMERIC(4,1)
);

CREATE TABLE IF NOT EXISTS pricing_plans (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    slug            TEXT NOT NULL UNIQUE,
    price_monthly   NUMERIC(8,2),
    price_yearly    NUMERIC(8,2),
    description     TEXT,
    features        TEXT[],
    is_popular      BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS admission_cycles (
    id              SERIAL PRIMARY KEY,
    cohort_name     TEXT NOT NULL,
    program         TEXT NOT NULL,
    app_open_date   DATE,
    app_close_date  DATE,
    interview_date  DATE,
    result_date     DATE,
    start_date      DATE,
    seats_available INT,
    notes           TEXT
);

CREATE TABLE IF NOT EXISTS faqs (
    id          SERIAL PRIMARY KEY,
    category    TEXT,
    question    TEXT NOT NULL,
    answer      TEXT NOT NULL,
    embedding   VECTOR(384)
);

CREATE TABLE IF NOT EXISTS scholarships (
    id              SERIAL PRIMARY KEY,
    name            TEXT NOT NULL,
    description     TEXT,
    discount_pct    INT,
    eligibility     TEXT,
    deadline        DATE,
    apply_url       TEXT
);

CREATE TABLE IF NOT EXISTS reviews (
    id          SERIAL PRIMARY KEY,
    course_id   UUID REFERENCES courses(id),
    student     TEXT,
    rating      INT CHECK (rating BETWEEN 1 AND 5),
    comment     TEXT,
    created_at  DATE
);


-- ─────────────────────────────────────────────
--  CATEGORIES
-- ─────────────────────────────────────────────

INSERT INTO categories (name, slug, description, icon) VALUES
('Web Development',      'web-dev',       'Frontend, backend, and fullstack web development courses.',          '🌐'),
('Data Science',         'data-science',  'Data analysis, machine learning, and AI courses.',                  '📊'),
('Mobile Development',   'mobile-dev',    'iOS, Android and cross-platform app development.',                  '📱'),
('UI/UX Design',         'uiux-design',   'User interface and user experience design principles and tools.',   '🎨'),
('DevOps & Cloud',       'devops-cloud',  'Cloud infrastructure, CI/CD pipelines, and containerization.',      '☁️'),
('Cybersecurity',        'cybersecurity', 'Ethical hacking, network security, and secure coding.',             '🔐'),
('Blockchain',           'blockchain',    'Web3, smart contracts, DeFi, and decentralized applications.',      '⛓️'),
('Game Development',     'game-dev',      'Build 2D and 3D games using Unity and Unreal Engine.',              '🎮');


-- ─────────────────────────────────────────────
--  INSTRUCTORS
-- ─────────────────────────────────────────────

INSERT INTO instructors (name, title, bio, expertise, linkedin, rating, total_students) VALUES
(
  'Sarah Mitchell',
  'Senior Fullstack Engineer',
  'Sarah has 12 years of experience building scalable web apps at companies like Stripe and Shopify. She is passionate about teaching clean, production-grade code.',
  ARRAY['React','Node.js','PostgreSQL','System Design'],
  'linkedin.com/in/sarah-mitchell-dev',
  4.9, 18400
),
(
  'Rahul Sharma',
  'ML Engineer & Data Scientist',
  'Rahul holds a PhD in Computer Science from Stanford and has published research on NLP and computer vision. He simplifies complex ML concepts into actionable skills.',
  ARRAY['Python','TensorFlow','PyTorch','NLP','Computer Vision'],
  'linkedin.com/in/rahul-sharma-ml',
  4.8, 22100
),
(
  'Aisha Nkosi',
  'iOS & React Native Expert',
  'Aisha worked as a lead mobile engineer at Uber and Airbnb. She has shipped over 30 apps to the App Store and Google Play.',
  ARRAY['Swift','Kotlin','React Native','Flutter'],
  'linkedin.com/in/aisha-nkosi-mobile',
  4.7, 9800
),
(
  'Carlos Vega',
  'UX Design Lead',
  'Carlos is a former design lead at Adobe and Figma. He has designed products used by over 50 million people worldwide.',
  ARRAY['Figma','User Research','Prototyping','Design Systems'],
  'linkedin.com/in/carlos-vega-ux',
  4.9, 13500
),
(
  'Priya Patel',
  'DevOps & Cloud Architect',
  'Priya is an AWS Certified Solutions Architect with 10 years of experience in infrastructure at Netflix and LinkedIn.',
  ARRAY['AWS','Docker','Kubernetes','Terraform','CI/CD'],
  'linkedin.com/in/priya-patel-devops',
  4.8, 11200
),
(
  'James Okafor',
  'Ethical Hacker & Security Engineer',
  'James is a certified CEH and OSCP holder. He has helped secure systems at Fortune 500 companies and runs a popular security blog.',
  ARRAY['Penetration Testing','Network Security','OWASP','Burp Suite'],
  'linkedin.com/in/james-okafor-security',
  4.9, 8700
),
(
  'Lena Hoffmann',
  'Blockchain & Web3 Developer',
  'Lena is a core contributor to several DeFi protocols and has built smart contracts managing over $200M in TVL.',
  ARRAY['Solidity','Ethereum','Hardhat','DeFi','NFTs'],
  'linkedin.com/in/lena-hoffmann-web3',
  4.7, 6300
),
(
  'David Chen',
  'Game Developer & Unity Expert',
  'David has shipped 8 commercial games on Steam and mobile. He teaches game mechanics, performance, and publishing.',
  ARRAY['Unity','C#','Unreal Engine','3D Modeling','Game Design'],
  'linkedin.com/in/david-chen-games',
  4.8, 7900
);


-- ─────────────────────────────────────────────
--  COURSES
-- ─────────────────────────────────────────────

-- Pull instructor ids into variables using a CTE pattern inside DO block
DO $$
DECLARE
  v_sarah   UUID; v_rahul  UUID; v_aisha UUID; v_carlos UUID;
  v_priya   UUID; v_james  UUID; v_lena  UUID; v_david  UUID;
  v_web     INT;  v_ds     INT;  v_mob   INT;  v_ux     INT;
  v_devops  INT;  v_sec    INT;  v_bc    INT;  v_game   INT;
BEGIN
  SELECT id INTO v_sarah  FROM instructors WHERE name = 'Sarah Mitchell';
  SELECT id INTO v_rahul  FROM instructors WHERE name = 'Rahul Sharma';
  SELECT id INTO v_aisha  FROM instructors WHERE name = 'Aisha Nkosi';
  SELECT id INTO v_carlos FROM instructors WHERE name = 'Carlos Vega';
  SELECT id INTO v_priya  FROM instructors WHERE name = 'Priya Patel';
  SELECT id INTO v_james  FROM instructors WHERE name = 'James Okafor';
  SELECT id INTO v_lena   FROM instructors WHERE name = 'Lena Hoffmann';
  SELECT id INTO v_david  FROM instructors WHERE name = 'David Chen';

  SELECT id INTO v_web    FROM categories WHERE slug = 'web-dev';
  SELECT id INTO v_ds     FROM categories WHERE slug = 'data-science';
  SELECT id INTO v_mob    FROM categories WHERE slug = 'mobile-dev';
  SELECT id INTO v_ux     FROM categories WHERE slug = 'uiux-design';
  SELECT id INTO v_devops FROM categories WHERE slug = 'devops-cloud';
  SELECT id INTO v_sec    FROM categories WHERE slug = 'cybersecurity';
  SELECT id INTO v_bc     FROM categories WHERE slug = 'blockchain';
  SELECT id INTO v_game   FROM categories WHERE slug = 'game-dev';

  INSERT INTO courses (
    title, slug, category_id, instructor_id,
    short_description, full_description, level,
    duration_weeks, hours_per_week, price_usd, discounted_price,
    prerequisites, skills_gained, certificate, is_live, is_featured,
    enrollment_open, next_cohort_start, rating, total_reviews, total_enrolled
  ) VALUES

  -- ── WEB DEVELOPMENT ──────────────────────────────
  (
    'Fullstack Web Bootcamp',
    'fullstack-web-bootcamp',
    v_web, v_sarah,
    'Go from zero to fullstack developer. Build real apps with React, Node.js, and PostgreSQL.',
    'This comprehensive bootcamp takes you from HTML basics all the way through building and deploying production-grade fullstack applications. You will master React for the frontend, Node.js and Express for the backend, and PostgreSQL for your database. The course includes 5 real-world projects including a social platform, an e-commerce store, and a real-time chat app. Weekly live sessions with Sarah and a private Discord community of 10,000+ students.',
    'Beginner',
    16, 10,
    499.00, 349.00,
    ARRAY['Basic computer skills', 'No prior coding experience needed'],
    ARRAY['HTML & CSS','JavaScript (ES6+)','React','Node.js','Express','PostgreSQL','REST APIs','Authentication','Deployment (Vercel + Railway)'],
    TRUE, TRUE, TRUE,
    TRUE, '2025-09-01', 4.9, 3842, 18400
  ),
  (
    'Advanced React & Next.js',
    'advanced-react-nextjs',
    v_web, v_sarah,
    'Master React patterns, Next.js App Router, server components, and performance optimization.',
    'Designed for developers who already know React basics, this course dives deep into advanced patterns: compound components, render props, custom hooks, Suspense, and concurrent features. The second half covers Next.js 14 App Router, server components, streaming, edge functions, and SEO. You will build a production SaaS dashboard with authentication, billing, and analytics.',
    'Advanced',
    8, 8,
    349.00, 249.00,
    ARRAY['React basics','JavaScript ES6+','Basic Node.js knowledge'],
    ARRAY['React advanced patterns','Next.js 14 App Router','Server Components','Edge Runtime','Performance optimization','SaaS architecture'],
    TRUE, FALSE, TRUE,
    TRUE, '2025-08-15', 4.8, 1204, 5600
  ),
  (
    'Python for Web Development',
    'python-web-dev',
    v_web, v_rahul,
    'Build web apps and REST APIs with Python, FastAPI, and SQLAlchemy.',
    'This course teaches you to build robust web APIs and full web applications using Python. Starting with Python fundamentals, you will progress to FastAPI for building lightning-fast APIs, SQLAlchemy for database management, and Celery for background tasks. Final project is a fully deployed task management SaaS.',
    'Intermediate',
    10, 8,
    299.00, 199.00,
    ARRAY['Basic Python knowledge','Understanding of web concepts'],
    ARRAY['Python','FastAPI','SQLAlchemy','Alembic','Celery','Redis','Docker','REST API design'],
    TRUE, FALSE, FALSE,
    TRUE, '2025-09-15', 4.7, 892, 4100
  ),

  -- ── DATA SCIENCE ──────────────────────────────────
  (
    'Data Science Masterclass',
    'data-science-masterclass',
    v_ds, v_rahul,
    'Learn Python, statistics, machine learning, and deep learning from scratch.',
    'The most complete data science course on DevNest. You will start with Python for data analysis (NumPy, Pandas, Matplotlib), progress through statistical foundations, then build machine learning models with scikit-learn, and finally dive into deep learning with PyTorch. Real-world projects include predicting house prices, customer churn analysis, sentiment analysis, and an image classifier. Includes a full section on deploying ML models as APIs.',
    'Beginner',
    20, 10,
    549.00, 399.00,
    ARRAY['High school mathematics','No programming experience needed'],
    ARRAY['Python','NumPy','Pandas','Matplotlib','scikit-learn','PyTorch','SQL','Feature Engineering','Model Deployment','MLflow'],
    TRUE, TRUE, TRUE,
    TRUE, '2025-09-01', 4.9, 4521, 22100
  ),
  (
    'Natural Language Processing with Transformers',
    'nlp-transformers',
    v_ds, v_rahul,
    'Build state-of-the-art NLP applications using Hugging Face and PyTorch.',
    'Covers the complete NLP pipeline from tokenization through transformer architecture, fine-tuning BERT/GPT models, and building production NLP pipelines. Projects include a sentiment analyzer, question-answering system, document summarizer, and a custom chatbot. Uses the Hugging Face ecosystem throughout.',
    'Advanced',
    10, 8,
    449.00, 329.00,
    ARRAY['Python proficiency','Basic ML knowledge','Linear algebra fundamentals'],
    ARRAY['Transformer architecture','Hugging Face','BERT','GPT fine-tuning','RAG pipelines','LangChain','Vector databases','NLP evaluation metrics'],
    TRUE, FALSE, TRUE,
    TRUE, '2025-08-20', 4.9, 1873, 9200
  ),
  (
    'SQL & Database Design',
    'sql-database-design',
    v_ds, v_sarah,
    'Master SQL from basics to advanced queries, indexing, and database design.',
    'Complete SQL course covering SELECT to complex window functions, CTEs, and performance tuning. Also covers relational database design principles, normalization, indexing strategies, and query optimization. Final project is designing and optimizing a database for a multi-tenant SaaS application.',
    'Beginner',
    6, 6,
    199.00, 129.00,
    ARRAY['No experience needed'],
    ARRAY['SQL','PostgreSQL','Database design','Normalization','Indexing','Query optimization','Window functions','CTEs'],
    TRUE, FALSE, FALSE,
    TRUE, '2025-08-01', 4.7, 2103, 11800
  ),

  -- ── MOBILE DEVELOPMENT ────────────────────────────
  (
    'iOS Development with Swift',
    'ios-swift',
    v_mob, v_aisha,
    'Build and publish native iOS apps using Swift and SwiftUI.',
    'Comprehensive iOS development course starting from Swift fundamentals through SwiftUI for modern UI, Core Data for persistence, networking with async/await, and publishing on the App Store. You will build 6 complete apps including a weather app, a to-do list, a photo editor, and a social media clone.',
    'Beginner',
    14, 8,
    449.00, 299.00,
    ARRAY['Mac computer required','No programming experience needed'],
    ARRAY['Swift','SwiftUI','Core Data','Networking','Push Notifications','App Store publishing','In-App Purchases'],
    TRUE, FALSE, TRUE,
    TRUE, '2025-09-10', 4.8, 1342, 6700
  ),
  (
    'React Native Cross-Platform Apps',
    'react-native',
    v_mob, v_aisha,
    'Ship iOS and Android apps from a single React Native codebase.',
    'Learn to build production-quality mobile apps that run on both iOS and Android using React Native and Expo. Covers navigation, animations, camera, maps, push notifications, and app store publishing. Includes a full Airbnb-style clone project.',
    'Intermediate',
    12, 8,
    399.00, 279.00,
    ARRAY['JavaScript fundamentals','Basic React knowledge'],
    ARRAY['React Native','Expo','React Navigation','Animations','Redux Toolkit','Firebase','App Store & Play Store publishing'],
    TRUE, FALSE, FALSE,
    TRUE, '2025-09-01', 4.7, 987, 4900
  ),

  -- ── UI/UX DESIGN ─────────────────────────────────
  (
    'UI/UX Design Bootcamp',
    'uiux-design-bootcamp',
    v_ux, v_carlos,
    'Design beautiful, user-centred products using Figma from day one.',
    'Complete UI/UX design course covering design thinking, user research, wireframing, prototyping, and handoff to developers. You will build a full design system, conduct user interviews, run usability tests, and create a polished portfolio with 4 case studies. Industry-standard tools: Figma, Maze, and Notion.',
    'Beginner',
    12, 8,
    399.00, 279.00,
    ARRAY['No design experience needed','A computer and curiosity'],
    ARRAY['Design thinking','User research','Wireframing','Figma','Prototyping','Usability testing','Design systems','Portfolio building'],
    TRUE, TRUE, TRUE,
    TRUE, '2025-09-01', 4.9, 2341, 13500
  ),
  (
    'Advanced Figma & Design Systems',
    'advanced-figma-design-systems',
    v_ux, v_carlos,
    'Build scalable design systems and master Figma advanced features.',
    'Deep dive into Figma variables, component properties, auto-layout, and advanced prototyping. The course focuses on building and maintaining a production-grade design system used by a real team. Perfect for designers moving into senior roles.',
    'Advanced',
    6, 6,
    299.00, 199.00,
    ARRAY['2+ years of Figma experience','Basic UI design knowledge'],
    ARRAY['Figma variables','Component properties','Auto-layout','Design tokens','Storybook integration','Figma plugins','Design ops'],
    TRUE, FALSE, FALSE,
    TRUE, '2025-08-10', 4.8, 678, 3200
  ),

  -- ── DEVOPS & CLOUD ────────────────────────────────
  (
    'AWS Cloud Practitioner to Solutions Architect',
    'aws-solutions-architect',
    v_devops, v_priya,
    'Go from AWS beginner to certified Solutions Architect with hands-on labs.',
    'This course prepares you for the AWS Solutions Architect Associate certification while teaching real cloud skills. Covers EC2, S3, RDS, Lambda, VPC, IAM, CloudFront, ECS, and more. Every topic includes hands-on labs in a real AWS environment. Includes 3 practice exams with 65 questions each.',
    'Intermediate',
    12, 8,
    399.00, 279.00,
    ARRAY['Basic understanding of networking','Linux command line basics'],
    ARRAY['AWS core services','VPC networking','IAM security','Serverless architecture','Cost optimization','High availability design','AWS certification prep'],
    TRUE, FALSE, TRUE,
    TRUE, '2025-08-15', 4.9, 1987, 11200
  ),
  (
    'Docker & Kubernetes in Production',
    'docker-kubernetes',
    v_devops, v_priya,
    'Containerize apps with Docker and orchestrate them at scale with Kubernetes.',
    'Practical DevOps course focused on containerization and orchestration. You will Dockerize a fullstack application, push to a private registry, deploy on a Kubernetes cluster (EKS), set up Helm charts, configure monitoring with Prometheus and Grafana, and implement zero-downtime deployments.',
    'Intermediate',
    8, 8,
    349.00, 229.00,
    ARRAY['Linux basics','Basic understanding of web apps','Some cloud experience helpful'],
    ARRAY['Docker','Docker Compose','Kubernetes','Helm','EKS','Terraform','Prometheus','Grafana','CI/CD pipelines'],
    TRUE, FALSE, FALSE,
    TRUE, '2025-09-01', 4.8, 1123, 6800
  ),

  -- ── CYBERSECURITY ─────────────────────────────────
  (
    'Ethical Hacking & Penetration Testing',
    'ethical-hacking',
    v_sec, v_james,
    'Learn penetration testing techniques used by professional security researchers.',
    'Hands-on ethical hacking course using Kali Linux. Covers the full penetration testing methodology: reconnaissance, scanning, exploitation, and post-exploitation. You will practice on intentionally vulnerable machines (Metasploitable, DVWA, HackTheBox). Prepares you for CEH and OSCP certifications.',
    'Intermediate',
    14, 8,
    449.00, 329.00,
    ARRAY['Basic Linux knowledge','Networking fundamentals (TCP/IP)','Basic Python scripting'],
    ARRAY['Kali Linux','Nmap','Metasploit','Burp Suite','SQL injection','XSS','Privilege escalation','Report writing','CTF techniques'],
    TRUE, FALSE, TRUE,
    TRUE, '2025-09-15', 4.9, 1654, 8700
  ),
  (
    'Web Application Security (OWASP Top 10)',
    'web-app-security',
    v_sec, v_james,
    'Identify and fix the most critical web vulnerabilities using OWASP guidelines.',
    'Developer-focused security course covering every OWASP Top 10 vulnerability with live demos of exploits and defenses. Learn to write secure code from the start. Ideal for developers who want to build more secure applications and testers who want to find vulnerabilities.',
    'Intermediate',
    6, 6,
    299.00, 199.00,
    ARRAY['Basic web development knowledge','Understanding of HTTP'],
    ARRAY['OWASP Top 10','Burp Suite','Secure coding','Input validation','Authentication security','CSRF protection','Content Security Policy'],
    TRUE, FALSE, FALSE,
    TRUE, '2025-08-01', 4.8, 934, 4900
  ),

  -- ── BLOCKCHAIN ────────────────────────────────────
  (
    'Solidity & Smart Contract Development',
    'solidity-smart-contracts',
    v_bc, v_lena,
    'Build, test, and deploy Ethereum smart contracts using Solidity and Hardhat.',
    'Complete blockchain development course from Ethereum fundamentals through writing production-grade Solidity contracts, testing with Hardhat and Foundry, deploying on mainnet and L2s, and building a DeFi protocol from scratch. Security focus throughout — learn how exploits happen and how to prevent them.',
    'Intermediate',
    12, 8,
    449.00, 299.00,
    ARRAY['JavaScript knowledge','Basic understanding of blockchain concept'],
    ARRAY['Solidity','Hardhat','Foundry','OpenZeppelin','ERC-20','ERC-721 (NFTs)','DeFi mechanics','Smart contract auditing','IPFS'],
    TRUE, FALSE, TRUE,
    TRUE, '2025-09-01', 4.7, 876, 4600
  ),
  (
    'Web3 Frontend Development',
    'web3-frontend',
    v_bc, v_lena,
    'Build decentralised applications (dApps) with React, Wagmi, and ethers.js.',
    'Frontend-focused Web3 course for React developers. Learn to connect wallets (MetaMask, WalletConnect), read and write to smart contracts, handle transactions, and build dApp UIs. Projects include an NFT marketplace and a DeFi dashboard.',
    'Intermediate',
    8, 6,
    299.00, 199.00,
    ARRAY['React knowledge','Basic understanding of Ethereum'],
    ARRAY['ethers.js','Wagmi','viem','WalletConnect','The Graph','IPFS/Pinata','dApp architecture'],
    TRUE, FALSE, FALSE,
    TRUE, '2025-08-20', 4.6, 543, 2800
  ),

  -- ── GAME DEVELOPMENT ──────────────────────────────
  (
    'Unity Game Development Bootcamp',
    'unity-game-dev',
    v_game, v_david,
    'Build 2D and 3D games with Unity and C# from scratch to Steam publish.',
    'The most comprehensive Unity course on DevNest. Start with C# basics, then build 2D platformers, 3D shooters, and a multiplayer game. Covers physics, animations, UI, audio, particle systems, shader basics, and publishing on Steam and mobile app stores. 10 complete game projects included.',
    'Beginner',
    18, 8,
    499.00, 349.00,
    ARRAY['No programming or game dev experience needed'],
    ARRAY['C#','Unity','Physics','Animations','UI systems','Audio','Shaders (intro)','Multiplayer (Mirror)','Steam publishing','Mobile deployment'],
    TRUE, FALSE, TRUE,
    TRUE, '2025-09-01', 4.8, 2109, 7900
  );

END $$;


-- ─────────────────────────────────────────────
--  COURSE MODULES (for top 3 featured courses)
-- ─────────────────────────────────────────────

DO $$
DECLARE
  v_fullstack UUID; v_ds_master UUID; v_uiux UUID;
BEGIN
  SELECT id INTO v_fullstack  FROM courses WHERE slug = 'fullstack-web-bootcamp';
  SELECT id INTO v_ds_master  FROM courses WHERE slug = 'data-science-masterclass';
  SELECT id INTO v_uiux       FROM courses WHERE slug = 'uiux-design-bootcamp';

  INSERT INTO course_modules (course_id, module_no, title, description, duration_hr) VALUES
  -- Fullstack Bootcamp modules
  (v_fullstack, 1,  'HTML & CSS Foundations',          'Semantic HTML, Flexbox, Grid, responsive design', 12.0),
  (v_fullstack, 2,  'JavaScript Essentials',            'Variables, functions, DOM, async/await, fetch API', 15.0),
  (v_fullstack, 3,  'React Fundamentals',               'Components, props, state, hooks, routing', 14.0),
  (v_fullstack, 4,  'Advanced React Patterns',          'Context, reducers, custom hooks, performance', 10.0),
  (v_fullstack, 5,  'Node.js & Express',                'REST APIs, middleware, authentication, file uploads', 12.0),
  (v_fullstack, 6,  'PostgreSQL & Prisma',              'Schema design, queries, ORM, migrations', 10.0),
  (v_fullstack, 7,  'Authentication & Security',        'JWT, sessions, OAuth, rate limiting, CORS', 8.0),
  (v_fullstack, 8,  'Project 1 — Social Platform',     'Full build with auth, posts, likes, follows', 15.0),
  (v_fullstack, 9,  'Real-time with WebSockets',        'Socket.io, live notifications, chat', 8.0),
  (v_fullstack, 10, 'Deployment & DevOps Basics',       'Docker intro, Vercel, Railway, environment config', 6.0),
  (v_fullstack, 11, 'Project 2 — E-commerce Store',    'Cart, payments (Stripe), orders, admin panel', 20.0),
  (v_fullstack, 12, 'Testing & Code Quality',           'Jest, React Testing Library, Playwright, ESLint', 6.0),
  (v_fullstack, 13, 'Capstone — Your Portfolio App',   'Self-directed full project with mentor review', 16.0),

  -- Data Science Masterclass modules
  (v_ds_master, 1,  'Python for Data Science',          'NumPy, Pandas, data cleaning, file I/O', 14.0),
  (v_ds_master, 2,  'Data Visualisation',               'Matplotlib, Seaborn, Plotly dashboards', 8.0),
  (v_ds_master, 3,  'Statistics & Probability',         'Distributions, hypothesis testing, A/B tests', 12.0),
  (v_ds_master, 4,  'SQL for Data Analysis',            'Joins, window functions, CTEs, ETL basics', 8.0),
  (v_ds_master, 5,  'Machine Learning Foundations',     'scikit-learn, regression, classification, clustering', 16.0),
  (v_ds_master, 6,  'Feature Engineering',              'Encoding, scaling, selection, pipelines', 8.0),
  (v_ds_master, 7,  'Tree-based Models & Ensembles',    'Decision trees, Random Forest, XGBoost, LightGBM', 10.0),
  (v_ds_master, 8,  'Neural Networks with PyTorch',     'Tensors, autograd, training loops, CNNs', 14.0),
  (v_ds_master, 9,  'NLP Fundamentals',                 'Text preprocessing, TF-IDF, sentiment analysis', 8.0),
  (v_ds_master, 10, 'Model Deployment',                 'FastAPI serving, Docker, MLflow, monitoring', 8.0),
  (v_ds_master, 11, 'Capstone — End-to-end ML Project', 'Full project from EDA to production deployment', 16.0),

  -- UX Design Bootcamp modules
  (v_uiux, 1,  'Design Thinking & Process',            'Empathise, define, ideate, prototype, test', 6.0),
  (v_uiux, 2,  'User Research Methods',                'Interviews, surveys, competitive analysis', 8.0),
  (v_uiux, 3,  'Information Architecture',             'Sitemaps, card sorting, user flows', 6.0),
  (v_uiux, 4,  'Wireframing & Lo-fi Prototyping',      'Sketching, Figma frames, low-fidelity flows', 8.0),
  (v_uiux, 5,  'Visual Design Principles',             'Typography, colour theory, spacing, grids', 10.0),
  (v_uiux, 6,  'Figma Mastery',                        'Components, variants, auto-layout, styles', 10.0),
  (v_uiux, 7,  'Hi-fi Prototyping & Micro-interactions','Advanced Figma prototyping, motion design', 8.0),
  (v_uiux, 8,  'Usability Testing',                    'Planning, moderation, synthesis, reporting', 6.0),
  (v_uiux, 9,  'Design Systems',                       'Tokens, component libraries, documentation', 8.0),
  (v_uiux, 10, 'Developer Handoff',                    'Figma dev mode, Zeplin, CSS annotations', 4.0),
  (v_uiux, 11, 'Portfolio Case Studies',               'Writing and presenting 4 polished case studies', 10.0);

END $$;


-- ─────────────────────────────────────────────
--  PRICING PLANS
-- ─────────────────────────────────────────────

INSERT INTO pricing_plans (name, slug, price_monthly, price_yearly, description, features, is_popular) VALUES
(
  'Free',
  'free',
  0.00, 0.00,
  'Try DevNest with limited access.',
  ARRAY[
    'Access to 5 free courses',
    'Community forum access',
    'Course previews',
    'No certificate'
  ],
  FALSE
),
(
  'Starter',
  'starter',
  29.00, 249.00,
  'Perfect for individuals learning one skill at a time.',
  ARRAY[
    'Access to 1 course of your choice',
    'All course videos and materials',
    'Community Discord access',
    'Certificate of completion',
    'Email support'
  ],
  FALSE
),
(
  'Pro',
  'pro',
  59.00, 499.00,
  'Unlimited learning for serious developers.',
  ARRAY[
    'Unlimited access to all 16 courses',
    'Live cohort sessions (2x per month)',
    'Priority Discord with instructors',
    'All certificates',
    'Project code reviews (2/month)',
    'Job board access',
    'Email & chat support'
  ],
  TRUE
),
(
  'Pro Plus',
  'pro-plus',
  99.00, 849.00,
  'For professionals who want mentorship and career support.',
  ARRAY[
    'Everything in Pro',
    '1-on-1 monthly mentor session (45 min)',
    'Unlimited code reviews',
    'LinkedIn profile review',
    'Resume & portfolio review',
    'Mock technical interview (1/month)',
    'Early access to new courses',
    'Dedicated Slack channel with your mentor'
  ],
  FALSE
),
(
  'Team',
  'team',
  49.00, 419.00,
  'Per seat pricing for companies. Minimum 5 seats.',
  ARRAY[
    'Everything in Pro for each team member',
    'Team analytics dashboard',
    'Custom learning paths',
    'Quarterly team progress reports',
    'Dedicated account manager',
    'Bulk invoice billing',
    'SSO support'
  ],
  FALSE
);


-- ─────────────────────────────────────────────
--  ADMISSION CYCLES / COHORT SCHEDULE
-- ─────────────────────────────────────────────

INSERT INTO admission_cycles (
  cohort_name, program,
  app_open_date, app_close_date, interview_date, result_date, start_date,
  seats_available, notes
) VALUES
('Fall 2025 Cohort A',   'Fullstack Web Bootcamp',              '2025-07-01','2025-08-10','2025-08-15','2025-08-20','2025-09-01',  60, 'Live sessions every Monday & Wednesday 6–8 PM UTC'),
('Fall 2025 Cohort A',   'Data Science Masterclass',            '2025-07-01','2025-08-15','2025-08-18','2025-08-22','2025-09-01',  50, 'Live sessions every Tuesday & Thursday 5–7 PM UTC'),
('Fall 2025 Cohort A',   'UI/UX Design Bootcamp',               '2025-07-01','2025-08-20','2025-08-22','2025-08-25','2025-09-01',  40, 'Live critique sessions every Friday 4–6 PM UTC'),
('Fall 2025 Cohort A',   'Unity Game Development Bootcamp',     '2025-07-01','2025-08-20','2025-08-22','2025-08-25','2025-09-01',  35, 'Live sessions every Saturday 10 AM–12 PM UTC'),
('Fall 2025 Cohort B',   'iOS Development with Swift',          '2025-07-15','2025-08-25','2025-08-28','2025-09-02','2025-09-10',  30, 'Mac required. Live sessions Wednesdays 6–8 PM UTC'),
('Late Fall 2025',       'Ethical Hacking & Penetration Testing','2025-08-01','2025-09-05','2025-09-08','2025-09-12','2025-09-15', 25, 'Kali Linux VM setup guide provided on enrolment'),
('Late Fall 2025',       'AWS Cloud Practitioner to Solutions Architect','2025-07-15','2025-08-10','2025-08-12','2025-08-14','2025-08-15', 45, 'AWS Free Tier account required'),
('Winter 2026 Cohort A', 'Fullstack Web Bootcamp',              '2025-10-01','2025-11-10','2025-11-15','2025-11-20','2025-12-01',  60, 'Applications open October 2025'),
('Winter 2026 Cohort A', 'Data Science Masterclass',            '2025-10-01','2025-11-15','2025-11-18','2025-11-22','2025-12-01',  50, 'Applications open October 2025'),
('Self-Paced Rolling',   'All Self-Paced Courses',              '2025-01-01','2099-12-31', NULL,        NULL,        NULL,          NULL,'Enrol anytime. No interview required. Start immediately after payment.');


-- ─────────────────────────────────────────────
--  FAQS
-- ─────────────────────────────────────────────

INSERT INTO faqs (category, question, answer) VALUES

-- Admissions
('Admissions', 'When do admissions open?',
 'Admissions for our live cohort programs open roughly 8 weeks before each cohort start date. For Fall 2025 cohorts starting September 1, applications opened July 1, 2025. Self-paced courses are open for enrolment year-round with no application required — you can start today.'),

('Admissions', 'Is there an interview for all programs?',
 'Interviews are only required for our live cohort programs (Fullstack Bootcamp, Data Science Masterclass, UI/UX Bootcamp, Unity Bootcamp, iOS Swift, Ethical Hacking, AWS). The interview is a short 20-minute video call to assess your motivation and goals — not a technical test. Self-paced courses require no interview.'),

('Admissions', 'How competitive is admission to the live cohorts?',
 'Our cohorts are selective but not highly exclusive. We accept roughly 70–80% of applicants who meet the prerequisites. We look for motivation, clear goals, and the ability to commit the required hours per week. Technical skill at time of application is less important than willingness to learn.'),

('Admissions', 'Can I defer my acceptance to a future cohort?',
 'Yes. If you are accepted to a cohort but cannot start, you may defer once to the next available cohort in the same program at no extra cost. Deferrals must be requested at least 14 days before the cohort start date.'),

('Admissions', 'What if I miss the application deadline?',
 'If you miss a deadline, you will be placed on the waitlist for that cohort. Waitlist spots open up as other accepted students defer or withdraw. You can also enrol in the self-paced version of most programs while you wait for the next live cohort.'),

-- Fees & Payments
('Fees', 'What are the course fees?',
 'Individual course prices range from $129 (SQL & Database Design) to $549 (Data Science Masterclass). All courses show their full price and discounted price on the course page. Subscription plans start at $29/month (Starter) and go up to $99/month (Pro Plus with mentorship). Yearly subscriptions save you up to 30% compared to monthly billing.'),

('Fees', 'What payment methods do you accept?',
 'We accept all major credit and debit cards (Visa, Mastercard, Amex), PayPal, and bank transfers for Team plans. For learners in Pakistan and other South Asian countries, we also accept EasyPaisa, JazzCash, and wire transfer. Crypto payments (USDC/USDT) are available for Blockchain course enrolments.'),

('Fees', 'Do you offer installment plans?',
 'Yes. For any course priced above $299, you can split your payment into 3 equal monthly installments at no extra charge. For Pro Plus and Team plans, monthly billing is available. Contact our support team to arrange a custom payment plan.'),

('Fees', 'Is there a refund policy?',
 'We offer a 14-day money-back guarantee on all individual course purchases. If you are not satisfied within 14 days of enrolment and have watched less than 30% of the course content, you are eligible for a full refund. Subscription plans can be cancelled anytime; you retain access until the end of the billing period.'),

('Fees', 'Are there any hidden fees?',
 'No hidden fees. The price you see covers all course materials, videos, projects, community access, and your certificate. Some courses note that you will need a third-party account (e.g. AWS Free Tier for the cloud course) which may have its own costs, but we always flag this upfront.'),

('Fees', 'Do prices include tax?',
 'Prices shown are exclusive of tax. Applicable VAT or GST may be added at checkout depending on your country of residence. Pakistani students are not subject to additional VAT on our platform.'),

-- Scholarships
('Scholarships', 'Are there any scholarships available?',
 'Yes. DevNest offers three scholarship programs: the Access Scholarship (50% discount for students from low-income backgrounds), the Women in Tech Scholarship (40% discount), and the Early Career Scholarship (30% discount for recent graduates within 1 year of graduation). See the Scholarships section for deadlines and application links.'),

('Scholarships', 'How do I apply for a scholarship?',
 'Visit devnestacademy.com/scholarships and complete the online application form. You will need to briefly describe your background, financial situation, and what you plan to build after completing the course. Decisions are made within 5 business days.'),

-- Certificates
('Certificates', 'Do I get a certificate when I finish?',
 'Yes. All paid courses include a verified digital certificate of completion issued by DevNest Academy. Certificates include a unique verification link and are shareable directly to LinkedIn. They are issued automatically when you complete all modules and pass the final project assessment.'),

('Certificates', 'Are your certificates industry recognised?',
 'Our certificates are recognised by our hiring partners including 40+ tech companies. They are not accredited by a government body (we are an online platform, not a university), but they carry significant weight with tech employers who care about demonstrated skills, not just credentials.'),

-- Technical
('Technical', 'What equipment do I need?',
 'Most courses require only a laptop or desktop computer with a modern browser and a stable internet connection. The iOS Swift course requires a Mac running macOS 14+. The Ethical Hacking course requires 8 GB RAM to run virtual machines. Specific requirements are listed on each course page.'),

('Technical', 'Are the course videos downloadable?',
 'Pro and Pro Plus subscribers can download videos for offline viewing through the DevNest mobile app (iOS and Android). Free and Starter plan users can only stream videos online.'),

('Technical', 'What happens if I fall behind in a live cohort?',
 'All live session recordings are uploaded within 24 hours. You can always catch up on your own time. If you fall significantly behind, your instructor will reach out to check in. In extreme circumstances (illness, family emergency), we can arrange a one-time transfer to the next cohort.'),

-- Career
('Career', 'Will this course help me get a job?',
 'Our Pro Plus plan includes dedicated career support: resume and LinkedIn review, mock technical interviews, and access to our hiring partner job board with 200+ live listings. Many of our graduates report landing their first tech job within 6 months of completing a bootcamp-style course. Results depend on effort, location, and market conditions.'),

('Career', 'Do you have hiring partners?',
 'Yes. DevNest has hiring partnerships with 40+ companies ranging from startups to enterprises. Partners get early access to our graduate pool and can post jobs exclusively on our platform. Partners include companies in the US, UK, Germany, UAE, and Pakistan.'),

('Career', 'What is the average salary of DevNest graduates?',
 'Based on our annual graduate survey, the median salary for graduates who secured a job within 12 months of completing a bootcamp course is $58,000/year globally. In Pakistan, the median is PKR 150,000/month for graduates working remotely for international clients.');


-- ─────────────────────────────────────────────
--  SCHOLARSHIPS
-- ─────────────────────────────────────────────

INSERT INTO scholarships (name, description, discount_pct, eligibility, deadline, apply_url) VALUES
(
  'Access Scholarship',
  'For learners from low-income backgrounds who would otherwise be unable to afford our courses. We believe financial constraints should never prevent anyone from building a career in tech.',
  50,
  'Open to all applicants. Requires a brief financial situation statement. No income proof documents needed.',
  '2025-08-01',
  'devnestacademy.com/scholarships/access'
),
(
  'Women in Tech Scholarship',
  'Supporting women and non-binary individuals entering or advancing in the tech industry.',
  40,
  'Open to women and non-binary individuals. Must be enrolling in a technical course (not design-only).',
  '2025-08-15',
  'devnestacademy.com/scholarships/women-in-tech'
),
(
  'Early Career Scholarship',
  'For recent graduates or career changers within 1 year of their graduation or career change.',
  30,
  'Graduated from any university or vocational program within the last 12 months, or changed careers within the last 12 months.',
  '2025-09-01',
  'devnestacademy.com/scholarships/early-career'
),
(
  'Pakistan & South Asia Discount',
  'A permanent regional pricing discount for students based in Pakistan, Bangladesh, India, Sri Lanka, and Nepal.',
  35,
  'Automatically applied at checkout based on billing address. No application required.',
  NULL,
  NULL
);


-- ─────────────────────────────────────────────
--  SAMPLE REVIEWS
-- ─────────────────────────────────────────────

DO $$
DECLARE
  v_fullstack UUID; v_ds UUID; v_uiux UUID; v_hack UUID; v_aws UUID;
BEGIN
  SELECT id INTO v_fullstack FROM courses WHERE slug = 'fullstack-web-bootcamp';
  SELECT id INTO v_ds        FROM courses WHERE slug = 'data-science-masterclass';
  SELECT id INTO v_uiux      FROM courses WHERE slug = 'uiux-design-bootcamp';
  SELECT id INTO v_hack      FROM courses WHERE slug = 'ethical-hacking';
  SELECT id INTO v_aws       FROM courses WHERE slug = 'aws-solutions-architect';

  INSERT INTO reviews (course_id, student, rating, comment, created_at) VALUES
  (v_fullstack, 'Ahmed R.',      5, 'This bootcamp completely changed my life. I went from knowing nothing to landing a remote frontend job in 8 months. Sarah explains everything so clearly.', '2025-03-14'),
  (v_fullstack, 'Sofia L.',      5, 'Best investment I have made. The projects are real, not toy examples. The Discord community is incredibly supportive.', '2025-04-02'),
  (v_fullstack, 'Bilal K.',      4, 'Excellent content. The backend section could go deeper on microservices but for a bootcamp this is outstanding. Highly recommend.', '2025-04-20'),
  (v_ds,        'Zainab M.',     5, 'Rahul is a genius at simplifying complex topics. I had zero coding experience and now I am building ML models. The capstone project helped me get an internship.', '2025-02-28'),
  (v_ds,        'Carlos T.',     5, 'Most complete data science course online. The PyTorch section alone is worth the price. I passed my ML engineer interview after finishing this.', '2025-05-10'),
  (v_uiux,      'Priya S.',      5, 'Carlos is an incredible teacher. The case study section helped me build a portfolio that got me 3 job interviews in my first week of applying.', '2025-03-30'),
  (v_uiux,      'Emma W.',       4, 'Really thorough and practical. Learned more here than in my university design courses. Would love more content on motion design.', '2025-04-15'),
  (v_hack,      'Omar F.',       5, 'James is the real deal. Hands-on labs, real vulnerable machines, clear explanations. Passed my CEH after this course. Cannot recommend enough.', '2025-05-01'),
  (v_aws,       'Nadia H.',      5, 'Passed my AWS SAA exam on the first attempt! The practice exams are almost identical in style to the real thing. Priya covers every topic thoroughly.', '2025-04-10'),
  (v_aws,       'Tariq A.',      5, 'I work as a DevOps engineer and this course filled all my gaps. The hands-on labs are essential — do not skip them.', '2025-05-20');

END $$;


-- ─────────────────────────────────────────────
--  INDEXES
-- ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_courses_category    ON courses(category_id);
CREATE INDEX IF NOT EXISTS idx_courses_level       ON courses(level);
CREATE INDEX IF NOT EXISTS idx_courses_featured    ON courses(is_featured);
CREATE INDEX IF NOT EXISTS idx_courses_enrollment  ON courses(enrollment_open);
CREATE INDEX IF NOT EXISTS idx_faqs_category       ON faqs(category);
CREATE INDEX IF NOT EXISTS idx_admissions_program  ON admission_cycles(program);
CREATE INDEX IF NOT EXISTS idx_reviews_course      ON reviews(course_id);

-- Vector indexes (created after embeddings are populated by the app)
-- CREATE INDEX idx_courses_embedding ON courses USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
-- CREATE INDEX idx_faqs_embedding    ON faqs    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);


-- ─────────────────────────────────────────────
--  SUMMARY VIEW (handy for agent queries)
-- ─────────────────────────────────────────────

CREATE OR REPLACE VIEW course_summary AS
SELECT
  c.id,
  c.title,
  c.slug,
  cat.name                                   AS category,
  i.name                                     AS instructor,
  c.level,
  c.duration_weeks,
  c.total_hours,
  c.price_usd,
  c.discounted_price,
  c.rating,
  c.total_enrolled,
  c.enrollment_open,
  c.next_cohort_start,
  c.is_featured,
  c.skills_gained
FROM courses c
JOIN categories cat ON cat.id = c.category_id
JOIN instructors i  ON i.id  = c.instructor_id;
