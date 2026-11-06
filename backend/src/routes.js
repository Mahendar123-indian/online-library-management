
const express = require("express");
const db = require("./database");

const router = express.Router();

// ADMIN LOGIN
router.post("/admin/login", (req, res) => {
    const { username, password } = req.body;

    const admin = db.prepare(
        "SELECT id, username FROM admins WHERE username=? AND password=?"
    ).get(username, password);

    if (!admin) {
        return res.status(401).json({
            message: "Invalid username or password"
        });
    }

    res.json({
        message: "Login successful",
        admin
    });
});

// DASHBOARD STATISTICS
router.get("/dashboard", (req, res) => {
    const totalBooks = db.prepare(
        "SELECT COUNT(*) AS count FROM books"
    ).get().count;

    const totalStudents = db.prepare(
        "SELECT COUNT(*) AS count FROM students"
    ).get().count;

    const availableBooks = db.prepare(
        "SELECT COALESCE(SUM(quantity), 0) AS count FROM books"
    ).get().count;

    const issuedBooks = db.prepare(
        "SELECT COUNT(*) AS count FROM issued_books WHERE actual_return_date IS NULL"
    ).get().count;

    res.json({
        totalBooks,
        totalStudents,
        availableBooks,
        issuedBooks
    });
});

// REGISTER STUDENT
router.post("/students/register", (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        db.prepare(
            "INSERT INTO students (name, email, password) VALUES (?, ?, ?)"
        ).run(name, email, password);

        res.status(201).json({
            message: "Student registered successfully"
        });

    } catch (error) {
        res.status(400).json({
            message: "Email already registered"
        });
    }
});

// GET ALL STUDENTS
router.get("/students", (req, res) => {
    const students = db.prepare(
        "SELECT id, name, email FROM students ORDER BY id DESC"
    ).all();

    res.json(students);
});

// ADD BOOK
router.post("/books", (req, res) => {
    const { title, author, quantity } = req.body;

    if (!title || !author || !Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
        return res.status(400).json({
            message: "Enter valid book details"
        });
    }

    const result = db.prepare(
        "INSERT INTO books (title, author, quantity) VALUES (?, ?, ?)"
    ).run(title, author, Number(quantity));

    res.status(201).json({
        message: "Book added successfully",
        id: result.lastInsertRowid
    });
});

// SEARCH AND VIEW BOOKS
router.get("/books", (req, res) => {
    const search = req.query.search || "";

    const books = db.prepare(
        `SELECT * FROM books
         WHERE title LIKE ? OR author LIKE ?
         ORDER BY id DESC`
    ).all(`%${search}%`, `%${search}%`);

    res.json(books);
});

// UPDATE BOOK
router.put("/books/:id", (req, res) => {
    const { title, author, quantity } = req.body;

    if (!title || !author || !Number.isInteger(Number(quantity)) || Number(quantity) < 0) {
        return res.status(400).json({
            message: "Enter valid book details"
        });
    }

    const result = db.prepare(
        "UPDATE books SET title=?, author=?, quantity=? WHERE id=?"
    ).run(title, author, Number(quantity), req.params.id);

    if (!result.changes) {
        return res.status(404).json({
            message: "Book not found"
        });
    }

    res.json({
        message: "Book updated successfully"
    });
});

// DELETE BOOK
router.delete("/books/:id", (req, res) => {
    try {
        const result = db.prepare(
            "DELETE FROM books WHERE id=?"
        ).run(req.params.id);

        if (!result.changes) {
            return res.status(404).json({
                message: "Book not found"
            });
        }

        res.json({
            message: "Book deleted successfully"
        });

    } catch (error) {
        res.status(400).json({
            message: "Cannot delete a book with issue records"
        });
    }
});

// ISSUE BOOK
router.post("/books/issue", (req, res) => {
    const { student_id, book_id } = req.body;

    const book = db.prepare(
        "SELECT * FROM books WHERE id=? AND quantity > 0"
    ).get(book_id);

    const student = db.prepare(
        "SELECT * FROM students WHERE id=?"
    ).get(student_id);

    if (!book || !student) {
        return res.status(400).json({
            message: "Invalid student or unavailable book"
        });
    }

    const today = new Date();
    const due = new Date(today);
    due.setDate(due.getDate() + 14);

    const issueDate = today.toISOString().split("T")[0];
    const returnDate = due.toISOString().split("T")[0];

    const issue = db.transaction(() => {
        db.prepare(
            `INSERT INTO issued_books
            (student_id, book_id, issue_date, return_date)
            VALUES (?, ?, ?, ?)`
        ).run(student_id, book_id, issueDate, returnDate);

        db.prepare(
            "UPDATE books SET quantity=quantity-1 WHERE id=?"
        ).run(book_id);
    });

    issue();

    res.status(201).json({
        message: "Book issued successfully",
        return_date: returnDate
    });
});

// VIEW ISSUED BOOKS
router.get("/issued", (req, res) => {
    const records = db.prepare(`
        SELECT
            issued_books.id,
            students.name AS student_name,
            books.title AS book_title,
            issued_books.issue_date,
            issued_books.return_date,
            issued_books.actual_return_date,
            issued_books.fine
        FROM issued_books
        JOIN students ON students.id = issued_books.student_id
        JOIN books ON books.id = issued_books.book_id
        ORDER BY issued_books.id DESC
    `).all();

    res.json(records);
});

// RETURN BOOK AND CALCULATE FINE
router.post("/books/return/:id", (req, res) => {
    const issued = db.prepare(
        `SELECT * FROM issued_books
         WHERE id=? AND actual_return_date IS NULL`
    ).get(req.params.id);

    if (!issued) {
        return res.status(404).json({
            message: "Active issue record not found"
        });
    }

    const today = new Date();
    const actualDate = today.toISOString().split("T")[0];

    const overdueDays = Math.max(
        0,
        Math.floor(
            (Date.parse(actualDate) - Date.parse(issued.return_date)) / 86400000
        )
    );

    const fine = overdueDays * 5;

    const returnBook = db.transaction(() => {
        db.prepare(
            `UPDATE issued_books
             SET actual_return_date=?, fine=?
             WHERE id=?`
        ).run(actualDate, fine, issued.id);

        db.prepare(
            "UPDATE books SET quantity=quantity+1 WHERE id=?"
        ).run(issued.book_id);
    });

    returnBook();

    res.json({
        message: "Book returned successfully",
        overdue_days: overdueDays,
        fine
    });
});



// =========================================
// 9. Dashboard Statistics
// =========================================

router.get("/dashboard", (req, res) => {
    try {
        const totalBooks = db.prepare(
            "SELECT COUNT(*) AS count FROM books"
        ).get().count;

        const availableBooks = db.prepare(
            "SELECT COALESCE(SUM(quantity), 0) AS count FROM books"
        ).get().count;

        const totalStudents = db.prepare(
            "SELECT COUNT(*) AS count FROM students"
        ).get().count;

        const issuedBooks = db.prepare(
            "SELECT COUNT(*) AS count FROM issued_books WHERE actual_return_date IS NULL"
        ).get().count;

        res.json({
            totalBooks,
            availableBooks,
            totalStudents,
            issuedBooks
        });

    } catch (error) {
        res.status(500).json({
            message: "Unable to load dashboard statistics"
        });
    }
});


// =========================================
// 10. Get All Students
// =========================================

router.get("/students", (req, res) => {
    try {
        const students = db.prepare(
            "SELECT id, name, email FROM students ORDER BY id DESC"
        ).all();

        res.json(students);

    } catch (error) {
        res.status(500).json({
            message: "Unable to load students"
        });
    }
});


// =========================================
// 11. Get Issued Books and Return Records
// =========================================

router.get("/issued", (req, res) => {
    try {
        const records = db.prepare(`
            SELECT
                issued_books.id,
                issued_books.student_id,
                issued_books.book_id,
                issued_books.issue_date,
                issued_books.return_date,
                issued_books.actual_return_date,
                issued_books.fine,
                students.name AS student_name,
                books.title AS book_title
            FROM issued_books
            JOIN students
                ON issued_books.student_id = students.id
            JOIN books
                ON issued_books.book_id = books.id
            ORDER BY issued_books.id DESC
        `).all();

        res.json(records);

    } catch (error) {
        res.status(500).json({
            message: "Unable to load issued book records"
        });
    }
});

module.exports = router;
