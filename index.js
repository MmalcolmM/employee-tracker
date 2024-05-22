require('dotenv').config();  // Load environment variables from a .env file into process.env
const inquirer = require('inquirer');  // Import inquirer for command-line prompts
const express = require('express');  // Import express to create a server
const { Pool } = require('pg');  // Import pg to interact with PostgreSQL

const PORT = process.env.PORT || 3001;  // Set the port from environment variables or use 3001 as default
const app = express();  // Create an instance of an express app

// Express middleware to parse incoming requests with URL-encoded payloads and JSON payloads
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Database credentials from environment variables
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;

// Function to create the database and tables
const createDatabaseAndTables = async () => {
    // Create a new connection pool to the postgres database
    const pool = new Pool({
        user: dbUser,
        password: dbPassword,
        host: 'localhost',
        database: 'postgres'  // Connect to the postgres database initially
    });

    const client = await pool.connect();  // Establish a connection to the database

    try {
        // Drop the existing employee_db database if it exists and create a new one
        await client.query(`DROP DATABASE IF EXISTS employee_db;`);
        await client.query(`CREATE DATABASE employee_db;`);
        console.log('Database created successfully.');

        // Connect to the newly created employee_db database
        const newPool = new Pool({
            user: dbUser,
            password: dbPassword,
            host: 'localhost',
            database: 'employee_db'
        });

        const newClient = await newPool.connect();  // Establish a connection to the new database

        // SQL query to create the department, role, and employee tables
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

        await newClient.query(createTablesQuery);  // Execute the query to create the tables
        console.log('Tables created successfully.');

        newClient.release();  // Release the new client back to the pool
    } catch (err) {
        // Log any errors that occur during the execution of the try block
        console.error('Error executing schema:', err.stack);
    } finally {
        client.release();  // Release the initial client back to the pool
    }
};

// Function to initialize the server
const initializeServer = async () => {
    await createDatabaseAndTables();  // Create the database and tables before starting the server

    const pool = new Pool({
        user: dbUser,
        password: dbPassword,
        host: 'localhost',
        database: 'employee_db'
    });

    console.log('Connected to the employee_db database.');

    // Main prompt function to interact with the user
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
            pool.query('SELECT * FROM employee', (err, res) => {
                if (err) {
                    console.error('Error querying employees:', err);
                } else {
                    console.table(res.rows);
                    mainPrompt();  // Call mainPrompt again to continue the interaction
                }
            });
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

            const { first_name, last_name, role_id, manager_id } = employeeDetails;
            const managerIdValue = manager_id === '' ? null : manager_id;

            pool.query(
                'INSERT INTO employee (first_name, last_name, role_id, manager_id) VALUES ($1, $2, $3, $4)',
                [first_name, last_name, role_id, managerIdValue],
                (err, res) => {
                    if (err) {
                        console.error('Error adding employee:', err);
                    } else {
                        console.log('Employee added successfully.');
                        mainPrompt();  // Call mainPrompt again to continue the interaction
                    }
                }
            );
        } else if (answers.action === "Delete employee") {
            pool.query(`SELECT id, first_name, last_name FROM employee`, async (err, res) => {
                if (err) {
                    console.error('Error querying employees:', err);
                    mainPrompt();
                } else {
                    const employees = res.rows.map(emp => ({
                        name: `${emp.first_name} ${emp.last_name}`,
                        value: emp.id
                    }));

                    const { employeeID } = await inquirer.prompt([
                        {
                            type: 'list',
                            name: 'employeeID',
                            message: 'Select the employee to delete:',
                            choices: employees
                        }
                    ]);

                    pool.query('DELETE FROM employee WHERE id = $1', [employeeID], (err, res) => {
                        if (err) {
                            console.error('Error deleting employee:', err);
                        } else {
                            console.log('Employee deleted successfully.');
                        }
                        mainPrompt();  // Call mainPrompt again to continue the interaction
                    });
                }
            });
        } else if (answers.action === "View all departments") {
            pool.query('SELECT * FROM department', (err, res) => {
                if (err) {
                    console.error('Error querying departments:', err);
                } else {
                    console.table(res.rows);
                    mainPrompt();  // Call mainPrompt again to continue the interaction
                }
            });
        } else if (answers.action === "Add department") {
            const departmentDetails = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'department_name',
                    message: 'Enter the department name:'
                }
            ]);

            const { department_name } = departmentDetails;
            console.log(department_name);

            pool.query(
                `INSERT INTO department (name) VALUES ('${department_name}');`,
                (err, res) => {
                    if (err) {
                        console.error('Error adding department', err);
                    } else {
                        console.log('Created department');
                        mainPrompt();  // Call mainPrompt again to continue the interaction
                    }
                }
            );
        } else if (answers.action === "View all roles") {
            pool.query('SELECT * FROM role', (err, res) => {
                if (err) {
                    console.error('Error querying roles:', err);
                } else {
                    console.table(res.rows);
                    mainPrompt();  // Call mainPrompt again to continue the interaction
                }
            });
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

            const { title, salary, department_id } = roleDetails;

            pool.query(
                'INSERT INTO role (title, salary, department_id) VALUES ($1, $2, $3)',
                [title, salary, department_id],
                (err, res) => {
                    if (err) {
                        console.error('Error adding role:', err);
                    } else {
                        console.log('Role added successfully.');
                        mainPrompt();  // Call mainPrompt again to continue the interaction
                    }
                }
            );
        } else if (answers.action === "Update employee role") {
            pool.query('SELECT id, first_name, last_name FROM employee', async (err, res) => {
                if (err) {
                    console.error('Error querying employees:', err);
                    mainPrompt();
                } else {
                    const employees = res.rows.map(emp => ({
                        name: `${emp.first_name} ${emp.last_name}`,
                        value: emp.id
                    }));

                    const { employeeId } = await inquirer.prompt([
                        {
                            type: 'list',
                            name: 'employeeId',
                            message: 'Select the employee to update:',
                            choices: employees
                        }
                    ]);

                    pool.query('SELECT id, title FROM role', async (err, res) => {
                        if (err) {
                            console.error('Error querying roles:', err);
                            mainPrompt();
                        } else {
                            const roles = res.rows.map(role => ({
                                name: role.title,
                                value: role.id
                            }));

                            const { roleId } = await inquirer.prompt([
                                {
                                    type: 'list',
                                    name: 'roleId',
                                    message: 'Select the new role:',
                                    choices: roles
                                }
                            ]);

                            pool.query(
                                'UPDATE employee SET role_id = $1 WHERE id = $2',
                                [roleId, employeeId],
                                (err, res) => {
                                    if (err) {
                                        console.error('Error updating employee role:', err);
                                    } else {
                                        console.log('Employee role updated successfully.');
                                        mainPrompt();  // Call mainPrompt again to continue the interaction
                                    }
                                }
                            );
                        }
                    });
                }
            });
        }
    };

    mainPrompt();  // Start the main prompt to interact with the user

    app.listen(PORT, () =>
        console.log(`App listening at http://localhost:${PORT}`)
    );
};

// Initialize the server and handle any errors that occur during initialization
initializeServer().catch(err => console.error(err));
