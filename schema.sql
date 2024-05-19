DROP DATABASE IF EXISTS employee_db;

CREATE DATABASE employee_db;

\c employee_db;

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
    ON DELETE CASCADE -- Changed to CASCADE for proper handling of deletions
);

CREATE TABLE employee (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role_id INTEGER NOT NULL,
    manager_id INTEGER SET DEFAULT NULL, 
    FOREIGN KEY (role_id) 
    REFERENCES role(id)
    ON DELETE CASCADE, -- Specified behavior for ON DELETE
    FOREIGN KEY (manager_id) 
    REFERENCES employee(id)
    ON DELETE SET NULL -- Added behavior for ON DELETE for manager_id
);
