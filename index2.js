require('dotenv').config();
const express = require('express');
const inquirer = require('inquirer');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3001;
const app = express();

// Express middleware
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Database credentials
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;

// Function to create the database and tables
const createDatabaseAndTables = async () => {
    const pool = new Pool({
        user: dbUser,
        password: dbPassword,
        host: 'localhost',
        database: 'postgres' // Connect to postgres database initially
    });

    const client = await pool.connect();

    try {
        // Drop and create the database
        await client.query(`DROP DATABASE IF EXISTS employee_db;`);
        await client.query(`CREATE DATABASE employee_db;`);
        console.log('Database created successfully.');

        // Connect to the new employee_db database
        const newPool = new Pool({
            user: dbUser,
            password: dbPassword,
            host: 'localhost',
            database: 'employee_db'
        });

        const newClient = await newPool.connect();

        // Create tables
        const createTablesQuery = `
            CREATE TABLE department (
                id SERIAL PRIMARY KEY,
                name VARCHAR(30) UNIQUE NOT NULL
            );

            CREATE TABLE role (
                id SERIAL PRIMARY KEY,
                title VARCHAR(30) UNIQUE NOT NULL,
                salary DECIMAL NOT NULL, 
                department_id INTEGER NOT NULL,
                FOREIGN KEY (department_id) 
                REFERENCES department(id)
                ON DELETE CASCADE
            );

            CREATE TABLE employee (
                id SERIAL PRIMARY KEY,
                first_name VARCHAR(100) NOT NULL,
                last_name VARCHAR(100) NOT NULL,
                role_id INTEGER NOT NULL,
                manager_id INTEGER, 
                FOREIGN KEY (role_id) 
                REFERENCES role(id)
                ON DELETE CASCADE,
                FOREIGN KEY (manager_id) 
                REFERENCES employee(id)
                ON DELETE SET NULL
            );
        `;

        await newClient.query(createTablesQuery);
        console.log('Tables created successfully.');

        newClient.release();
    } catch (err) {
        console.error('Error executing schema:', err.stack);
    } finally {
        client.release();
    }
};

// Connect to the employee_db database and initialize the server
const initializeServer = async () => {
    await createDatabaseAndTables();

    const pool = new Pool({
        user: dbUser,
        password: dbPassword,
        host: 'localhost',
        database: 'employee_db'
    });

    console.log('Connected to the employee_db database.');

   
    // Define root route. NEEDED THIS IN ORDER FOR THE GET AND POST REQUESTS TO ACTUALLY SHOW IN INSOMINIA
    app.get('/', (req, res) => {
        res.send('Welcome to the Employee Tracker API!');
    });

 // Define routes
    app.get('/employee', async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM employee');
            res.json(result.rows);
        } catch (err) {
            console.error('Error querying employees:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.post('/employee', async (req, res) => {
        const { first_name, last_name, role_id, manager_id } = req.body;
        const managerIdValue = manager_id || null;

        try {
            await pool.query(
                'INSERT INTO employee (first_name, last_name, role_id, manager_id) VALUES ($1, $2, $3, $4)',
                [first_name, last_name, role_id, managerIdValue]
            );
            res.status(201).json({ message: 'Employee added successfully.' });
        } catch (err) {
            console.error('Error adding employee:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.get('/department', async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM department');
            res.json(result.rows);
        } catch (err) {
            console.error('Error querying departments:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.get('/role', async (req, res) => {
        try {
            const result = await pool.query('SELECT * FROM role');
            res.json(result.rows);
        } catch (err) {
            console.error('Error querying roles:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    app.post('/roles', async (req, res) => {
        const { title, salary, department_id } = req.body;

        try {
            await pool.query(
                'INSERT INTO role (title, salary, department_id) VALUES ($1, $2, $3)',
                [title, salary, department_id]
            );
            res.status(201).json({ message: 'Role added successfully.' });
        } catch (err) {
            console.error('Error adding role:', err);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Add more routes for update and delete actions...

    app.listen(PORT, () => console.log(`App listening at http://localhost:${PORT}`));
};

const mainPrompt = async () => {
    const answers = await inquirer.prompt([
        {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: [
                'View all employees',
                'Add employee',
                'Update employee role',
                'View all roles',
                'Add role',
                'View all departments',
                'Add department',
                'Delete employee',
            ]
        }
    ]);

    if (answers.action === "View all employees") {
        const response = await fetch(`http://localhost:${PORT}/employees`);
        const data = await response.json();
        console.table(data);
    } else if (answers.action === 'Add employee') {
        const employeeDetails = await inquirer.prompt([
            {
                type: 'input',
                name: 'first_name',
                message: 'Enter the employee\'s first name:'
            },
            {
                type: 'input',
                name: 'last_name',
                message: 'Enter the employee\'s last name:'
            },
            {
                type: 'input',
                name: 'role_id',
                message: 'Enter the role ID#:'
            },
            {
                type: 'input',
                name: 'manager_id',
                message: 'Enter the Manager ID (leave blank if none):',
                default: null,
            }
        ]);

        await fetch(`http://localhost:${PORT}/employees`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(employeeDetails),
        });
        console.log('Employee added successfully.');
    } else if (answers.action === "View all departments") {
        const response = await fetch(`http://localhost:${PORT}/departments`);
        const data = await response.json();
        console.table(data);
    } else if (answers.action === "View all roles") {
        const response = await fetch(`http://localhost:${PORT}/roles`);
        const data = await response.json();
        console.table(data);
    } else if (answers.action === "Add role") {
        const roleDetails = await inquirer.prompt([
            {
                type: 'input',
                name: 'title',
                message: 'Enter the role title:'
            },
            {
                type: 'input',
                name: 'salary',
                message: 'Enter the salary for the role:'
            },
            {
                type: 'input',
                name: 'department_id',
                message: 'Enter the department ID:'
            }
        ]);

        await fetch(`http://localhost:${PORT}/roles`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(roleDetails),
        });
        console.log('Role added successfully.');
    }
    // Add handlers for update and delete actions...
};

initializeServer().then(() => mainPrompt()).catch(err => console.error(err));
