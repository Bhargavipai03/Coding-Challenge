# Coding-Challenge
# Store Rating Web Application

A full-stack web application that allows users to submit and view ratings for various stores. The platform features a robust, role-based access system for three distinct user types: System Administrators, Normal Users, and Store Owners.

## Features

### 👤 System Administrator
* **Full User Management**: Create, view, and delete all users (Admins, Normal Users, and Store Owners).
* **Full Store Management**: Create, view, and delete all stores.
* **Verification Workflow**: Approve and promote `Normal Users` who have requested to become `Store Owners`.
* **Dashboard Analytics**: View high-level statistics, including the total number of users, stores, and ratings on the platform.
* **Interactive Data Tables**: All user and store lists are fully sortable by key fields like name, email, and role.

### 🧑 Normal User
* **Account Management**: Secure sign-up and login functionality.
* **Store Discovery**: View a list of all registered stores. The list is sortable by name, address, and average rating.
* **Rating System**: Submit and modify star ratings (1-5) for any store. The user's own rating is clearly displayed alongside the overall average.
* **Become a Store Owner**: A user can submit a request to the administrator to have their account converted into a Store Owner account.

### 🏪 Store Owner
* **Secure Login**: Access the platform using their store-specific credentials.
* **Dedicated Dashboard**: View key metrics for their store, including the overall average rating and the total number of ratings received.
* **Detailed Ratings List**: See a list of all ratings submitted for their store, including the name of the user who submitted it and the date of the rating.

## Tech Stack

* **Frontend**: React, Tailwind CSS, Lucide React (for icons)
* **Backend**: Node.js, Express.js
* **Database**: PostgreSQL
* **Authentication**: JSON Web Tokens (JWT) with password hashing via `bcrypt.js`

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

You will need the following software installed on your computer:
* [Node.js](https://nodejs.org/) (which includes npm)
* [PostgreSQL](https://www.postgresql.org/download/)
* [Git](https://git-scm.com/downloads)

### Installation & Setup

1.  **Clone the repository to your local machine:**
    ```bash
    git clone <your-repository-url>
    cd robo
    ```

2.  **Setup the Backend:**
    * Navigate to the backend directory:
        ```bash
        cd backend
        ```
    * Install the required npm packages:
        ```bash
        npm install
        ```
    * **Create the Database**:
        * Open **pgAdmin 4**.
        * Connect to your PostgreSQL server.
        * Right-click on **Databases** > **Create** > **Database...**.
        * Enter `store_rating_db` as the database name and click **Save**.
    * **Configure Environment Variables**:
        * Create a new file in the `backend` folder named `.env`.
        * Copy the following content into it, replacing `'YourPassword'` with the password you set for PostgreSQL during installation.
        ```ini
        DB_USER=postgres
        DB_HOST=localhost
        DB_NAME=store_rating_db
        DB_PASSWORD='YourPassword'
        DB_PORT=5432
        JWT_SECRET='a-very-secret-key-that-you-should-change'
        ```
    * **Run the Backend Server**:
        ```bash
        node server.js
        ```
        The server should now be running on `http://localhost:5000`.

3.  **Setup the Frontend:**
    * Open a **new, separate terminal**.
    * Navigate to the frontend directory:
        ```bash
        cd frontend
        ```
    * Install the required npm packages:
        ```bash
        npm install
        ```
    * **Run the Frontend Development Server**:
        ```bash
        npm start
        ```
        The React application should now be running and will open automatically in your browser at `http://localhost:3000`.

## Default Admin Login

You can log in as an administrator to test the admin features using the default credentials created by the server on its first run.

* **Email**: `admin@storerating.com`
* **Password**: `Admin123!`
