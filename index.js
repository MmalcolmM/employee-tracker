require('dotenv').config();
const inquirer = require('inquirer');
const express = require('express');
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
                    console.table(res.rows), mainPrompt();
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
                        console.log('Employee added successfully.'), mainPrompt();
                    }
                }
            );
        } else if (answers.action === "Delete employee") {
            pool.query(`SELECT id, first_name, last_name FROM employee`, async (err, res) => {
                if (err){
                    console.error('Error querying employees:', err);
                    mainPrompt();
                } else {
                    const employees = res.rows.map(emp => ({
                        name: `${emp.first_name} ${emp.last_name}`,
                        value: emp.id
                    }));
                    
                    const { employeeID } =  await.inquirer.prompt([
                        {
                            type: 'list',
                            name: 'employeeID',
                            nessage: 'Select the employee to delete:',
                            choices: employees
                        }
                    ]);

                    pool.query('DELETE FROM employee WHERE id =$1', [employeeID], (err, res) => {
                        if (err) {
                            console.error('Error deleting employee:', err);
                        } else {
                            console.log('Employee deleted successfully.')
                        }
                        mainPrompt();
                    });
                }
            });
        } else if (answers.action === "View all departments") {
            pool.query('SELECT * FROM department', (err, res) => {
                if (err) {
                    console.error('Error querying departments:', err);
                } else {
                    console.table(res.rows), mainPrompt();
                }
            });
        } else if (answers.action === "Add department")  {
            const departmentDetails = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'department_name',
                    message: 'Enter the department name:'
                }
            ])
            const { department_name } = departmentDetails;
            console.log(department_name);
            pool.query(
                `INSERT INTO department (name) VALUES ('${department_name}');`,
                (err, res) => {
                    if (err) {
                        console.error('Error adding department', err);
                    } else {
                        console.log('Created department'), mainPrompt();
                    }
                }
            ); 
        }
        else if (answers.action === "View all roles") {
            pool.query('SELECT * FROM role', (err, res) => {
                if (err) {
                    console.err('Error querying roles:', err);
                } else {
                    console.table(res.rows), mainPrompt()
                }
            })
        } else if (answers.action === "Add role") {
            const roleDetails = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'title',
                    mesage: 'Enter the role title:'

                },
                {
                    type: 'input',
                    name: 'salary',
                    message: 'Enter the salary for the role:'
                },
                {
                    type: "input",
                    name: 'department_id',
                    message: 'Enter the department ID:'
                }
            ])
            const { title, salary, department_id } = roleDetails;
            const roleIdValue = department_id === '' ? null : department_id;

            pool.query(
                'INSERT INTO role (title, salary, department_id) VALUES ($1, $2, $3)',
                [title, salary, department_id, ],
                (err, res) => {
                    if (err) {
                        console.error('Error adding role:', err);
                    } else {
                        console.log('role added successfully.'), mainPrompt();
                    }
                });
        } else if (answers.action === "Update employee role") {

        }
        // Add handlers for update and delete actions here...
    };

    mainPrompt();

    app.listen(PORT, () =>
        console.log(`App listening at http://localhost:${PORT}`)
    );
};

initializeServer().catch(err => console.error(err));
