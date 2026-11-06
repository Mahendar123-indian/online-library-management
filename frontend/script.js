
/* =========================================
   LIBRADESK - DYNAMIC APPLICATION
   Node.js + Express + SQLite
========================================= */

const API_URL = "/api";

let books = [];
let students = [];
let issuedRecords = [];
let currentPage = "dashboard";
let toastTimer = null;

// =========================================
// COMMON HELPERS
// =========================================

const $ = (id) => document.getElementById(id);

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

async function apiRequest(endpoint, options = {}) {
    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
    }

    return data;
}

function showToast(message, type = "success") {
    const toast = $("toast");

    $("toastMessage").textContent = message;

    const icon = toast.querySelector("i");

    icon.className = type === "error"
        ? "fa-solid fa-circle-exclamation"
        : "fa-solid fa-circle-check";

    icon.style.color = type === "error" ? "#ff8290" : "#42d6a0";

    toast.classList.add("show");

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

function showMessage(elementId, message, type = "error") {
    const element = $(elementId);

    element.textContent = message;
    element.className = `form-message ${type}`;
}

function clearMessage(elementId) {
    const element = $(elementId);

    element.textContent = "";
    element.className = "form-message";
}

function showModal(id) {
    $(id).classList.add("show");
}

function closeModal(id) {
    $(id).classList.remove("show");
}

// =========================================
// LOGIN
// =========================================

$("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = $("username").value.trim();
    const password = $("password").value;

    clearMessage("loginMessage");

    try {
        const result = await apiRequest("/admin/login", {
            method: "POST",
            body: JSON.stringify({
                username,
                password
            })
        });

        // Demo-only UI state, not a secure authentication session.
        $("loginScreen").classList.add("hidden");
        $("app").classList.remove("hidden");

        $("loginForm").reset();

        showToast(`Welcome, ${result.admin.username}`);

        await loadAllData();

    } catch (error) {
        showMessage("loginMessage", error.message);
    }
});

// =========================================
// LOGOUT
// =========================================

$("logoutBtn").addEventListener("click", () => {
    $("app").classList.add("hidden");
    $("loginScreen").classList.remove("hidden");

    closeSidebar();

    currentPage = "dashboard";

    $("loginForm").reset();
    clearMessage("loginMessage");

    showToast("Signed out successfully");
});

// =========================================
// NAVIGATION
// =========================================

const pageConfig = {
    dashboard: {
        element: "dashboardPage",
        title: "Dashboard"
    },
    books: {
        element: "booksPage",
        title: "Book Management"
    },
    students: {
        element: "studentsPage",
        title: "Student Management"
    },
    issue: {
        element: "issuePage",
        title: "Issue Books"
    },
    returns: {
        element: "returnsPage",
        title: "Returns & Fines"
    }
};

function navigateTo(page) {
    if (!pageConfig[page]) return;

    currentPage = page;

    document.querySelectorAll(".page-section").forEach(section => {
        section.classList.remove("active");
    });

    $(pageConfig[page].element).classList.add("active");

    document.querySelectorAll(".nav-item").forEach(button => {
        button.classList.toggle(
            "active",
            button.dataset.page === page
        );
    });

    $("pageTitle").textContent = pageConfig[page].title;

    closeSidebar();

    if (page === "books") loadBooks();
    if (page === "students") loadStudents();
    if (page === "issue") loadIssueOptions();
    if (page === "returns") loadReturns();
}

document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", () => {
        navigateTo(button.dataset.page);
    });
});

document.querySelectorAll("[data-goto]").forEach(button => {
    button.addEventListener("click", () => {
        navigateTo(button.dataset.goto);
    });
});

// =========================================
// MOBILE SIDEBAR
// =========================================

function closeSidebar() {
    $("sidebar").classList.remove("open");
}

$("menuToggle").addEventListener("click", () => {
    $("sidebar").classList.toggle("open");
});

$("closeSidebar").addEventListener("click", closeSidebar);

// =========================================
// DATE
// =========================================

$("currentDate").textContent = new Intl.DateTimeFormat(
    "en-IN",
    {
        day: "numeric",
        month: "long",
        year: "numeric"
    }
).format(new Date());

// =========================================
// LOAD ALL DATA
// =========================================

async function loadAllData() {
    await Promise.all([
        loadDashboard(),
        loadBooks(),
        loadStudents(),
        loadReturns()
    ]);

    updateIssueOptions();
}

// =========================================
// DASHBOARD
// =========================================

async function loadDashboard() {
    try {
        const data = await apiRequest("/dashboard");

        $("totalBooks").textContent = data.totalBooks;
        $("totalStudents").textContent = data.totalStudents;
        $("availableBooks").textContent = data.availableBooks;
        $("issuedBooks").textContent = data.issuedBooks;

    } catch (error) {
        showToast(error.message, "error");
    }

    renderRecentBooks();
}

function renderRecentBooks() {
    const recent = books.slice(0, 5);

    if (recent.length === 0) {
        $("recentBooksTable").innerHTML = `
            <tr>
                <td colspan="3" class="empty-cell">
                    No books added yet
                </td>
            </tr>
        `;
        return;
    }

    $("recentBooksTable").innerHTML = recent.map(book => `
        <tr>
            <td><strong>${escapeHTML(book.title)}</strong></td>
            <td>${escapeHTML(book.author)}</td>
            <td>${book.quantity}</td>
        </tr>
    `).join("");
}

// =========================================
// BOOK MANAGEMENT
// =========================================

async function loadBooks(search = "") {
    try {
        books = await apiRequest(
            `/books?search=${encodeURIComponent(search)}`
        );

        renderBooks();
        renderRecentBooks();

        updateIssueOptions();

        $("bookCount").textContent =
            `${books.length} ${books.length === 1 ? "book" : "books"}`;

    } catch (error) {
        $("booksTable").innerHTML = `
            <tr><td colspan="6" class="empty-cell">
                ${escapeHTML(error.message)}
            </td></tr>
        `;
    }
}

function renderBooks() {
    if (books.length === 0) {
        $("booksTable").innerHTML = `
            <tr>
                <td colspan="6" class="empty-cell">
                    No books found. Add your first book.
                </td>
            </tr>
        `;
        return;
    }

    $("booksTable").innerHTML = books.map(book => {
        const available = Number(book.quantity) > 0;

        return `
            <tr>
                <td>#${book.id}</td>

                <td>
                    <strong>${escapeHTML(book.title)}</strong>
                </td>

                <td>${escapeHTML(book.author)}</td>

                <td>${book.quantity}</td>

                <td>
                    <span class="status-badge ${
                        available
                            ? "status-available"
                            : "status-unavailable"
                    }">
                        ${available ? "Available" : "Out of stock"}
                    </span>
                </td>

                <td>
                    <button class="action-btn"
                        data-edit-book="${book.id}"
                        title="Edit book">
                        <i class="fa-solid fa-pen"></i>
                    </button>

                    <button class="action-btn delete"
                        data-delete-book="${book.id}"
                        title="Delete book">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

// OPEN ADD BOOK MODAL

$("addBookBtn").addEventListener("click", () => {
    $("bookForm").reset();

    $("editBookId").value = "";
    $("bookQuantity").value = 1;
    $("bookQuantity").min = 1;

    $("bookModalTitle").textContent = "Add New Book";

    clearMessage("bookMessage");

    showModal("bookModal");
});

// SAVE OR UPDATE BOOK

$("bookForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const id = $("editBookId").value;

    const bookData = {
        title: $("bookTitle").value.trim(),
        author: $("bookAuthor").value.trim(),
        quantity: Number($("bookQuantity").value)
    };

    if (
        !bookData.title ||
        !bookData.author ||
        !Number.isInteger(bookData.quantity) ||
        bookData.quantity < (id ? 0 : 1)
    ) {
        showMessage("bookMessage", "Enter valid book information");
        return;
    }

    try {
        await apiRequest(
            id ? `/books/${id}` : "/books",
            {
                method: id ? "PUT" : "POST",
                body: JSON.stringify(bookData)
            }
        );

        closeModal("bookModal");

        showToast(id ? "Book updated successfully" : "Book added successfully");

        await loadBooks($("bookSearch").value.trim());
        await loadDashboard();

    } catch (error) {
        showMessage("bookMessage", error.message);
    }
});

// EDIT AND DELETE BOOKS

$("booksTable").addEventListener("click", async (event) => {
    const editButton = event.target.closest("[data-edit-book]");
    const deleteButton = event.target.closest("[data-delete-book]");

    if (editButton) {
        const id = Number(editButton.dataset.editBook);

        const book = books.find(item => item.id === id);

        if (!book) return;

        $("editBookId").value = book.id;
        $("bookTitle").value = book.title;
        $("bookAuthor").value = book.author;
        $("bookQuantity").value = book.quantity;
        $("bookQuantity").min = 0;

        $("bookModalTitle").textContent = "Update Book";

        clearMessage("bookMessage");

        showModal("bookModal");
    }

    if (deleteButton) {
        const id = Number(deleteButton.dataset.deleteBook);

        if (!confirm("Are you sure you want to delete this book?")) {
            return;
        }

        try {
            await apiRequest(`/books/${id}`, {
                method: "DELETE"
            });

            showToast("Book deleted successfully");

            await loadBooks($("bookSearch").value.trim());
            await loadDashboard();

        } catch (error) {
            showToast(error.message, "error");
        }
    }
});

// SEARCH BOOKS

let bookSearchTimer;

$("bookSearch").addEventListener("input", () => {
    clearTimeout(bookSearchTimer);

    bookSearchTimer = setTimeout(() => {
        loadBooks($("bookSearch").value.trim());
    }, 250);
});

// =========================================
// STUDENT MANAGEMENT
// =========================================

async function loadStudents() {
    try {
        students = await apiRequest("/students");

        renderStudents();

        $("studentCount").textContent =
            `${students.length} ${students.length === 1 ? "student" : "students"}`;

        updateIssueOptions();

    } catch (error) {
        $("studentsTable").innerHTML = `
            <tr><td colspan="3" class="empty-cell">
                ${escapeHTML(error.message)}
            </td></tr>
        `;
    }
}

function renderStudents() {
    const search = $("studentSearch").value.toLowerCase().trim();

    const filtered = students.filter(student =>
        student.name.toLowerCase().includes(search) ||
        student.email.toLowerCase().includes(search)
    );

    if (filtered.length === 0) {
        $("studentsTable").innerHTML = `
            <tr>
                <td colspan="3" class="empty-cell">
                    No students found
                </td>
            </tr>
        `;
        return;
    }

    $("studentsTable").innerHTML = filtered.map(student => `
        <tr>
            <td>#${student.id}</td>
            <td><strong>${escapeHTML(student.name)}</strong></td>
            <td>${escapeHTML(student.email)}</td>
        </tr>
    `).join("");
}

$("studentSearch").addEventListener("input", renderStudents);

// OPEN STUDENT MODAL

$("addStudentBtn").addEventListener("click", () => {
    $("studentForm").reset();
    clearMessage("studentMessage");
    showModal("studentModal");
});

// REGISTER STUDENT

$("studentForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const studentData = {
        name: $("studentName").value.trim(),
        email: $("studentEmail").value.trim(),
        password: $("studentPassword").value
    };

    if (studentData.password.length < 6) {
        showMessage(
            "studentMessage",
            "Password must contain at least 6 characters"
        );
        return;
    }

    try {
        await apiRequest("/students/register", {
            method: "POST",
            body: JSON.stringify(studentData)
        });

        closeModal("studentModal");

        showToast("Student registered successfully");

        await loadStudents();
        await loadDashboard();

    } catch (error) {
        showMessage("studentMessage", error.message);
    }
});

// =========================================
// ISSUE BOOK
// =========================================

function updateIssueOptions() {
    if (!$("issueStudent") || !$("issueBook")) return;

    const previousStudent = $("issueStudent").value;
    const previousBook = $("issueBook").value;

    $("issueStudent").innerHTML = `
        <option value="">Choose a student</option>
        ${students.map(student => `
            <option value="${student.id}">
                ${escapeHTML(student.name)} (${escapeHTML(student.email)})
            </option>
        `).join("")}
    `;

    $("issueBook").innerHTML = `
        <option value="">Choose an available book</option>
        ${books.filter(book => Number(book.quantity) > 0).map(book => `
            <option value="${book.id}">
                ${escapeHTML(book.title)} - ${escapeHTML(book.author)}
                (${book.quantity} available)
            </option>
        `).join("")}
    `;

    if (students.some(student => String(student.id) === previousStudent)) {
        $("issueStudent").value = previousStudent;
    }

    if (books.some(book =>
        String(book.id) === previousBook && Number(book.quantity) > 0
    )) {
        $("issueBook").value = previousBook;
    }
}

async function loadIssueOptions() {
    await Promise.all([
        loadStudents(),
        loadBooks()
    ]);

    updateIssueOptions();
}

$("issueForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const student_id = Number($("issueStudent").value);
    const book_id = Number($("issueBook").value);

    if (!student_id || !book_id) {
        showMessage("issueMessage", "Select both student and book");
        return;
    }

    try {
        const result = await apiRequest("/books/issue", {
            method: "POST",
            body: JSON.stringify({
                student_id,
                book_id
            })
        });

        $("issueForm").reset();

        showMessage(
            "issueMessage",
            `${result.message}. Due date: ${result.return_date}`,
            "success"
        );

        showToast("Book issued successfully");

        await loadAllData();

    } catch (error) {
        showMessage("issueMessage", error.message);
    }
});

// =========================================
// RETURN BOOKS AND FINES
// =========================================

async function loadReturns() {
    try {
        issuedRecords = await apiRequest("/issued");

        renderReturns();

        $("returnCount").textContent =
            `${issuedRecords.length} records`;

    } catch (error) {
        $("returnsTable").innerHTML = `
            <tr><td colspan="7" class="empty-cell">
                ${escapeHTML(error.message)}
            </td></tr>
        `;
    }
}

function calculateCurrentFine(dueDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const due = new Date(`${dueDate}T00:00:00`);

    const overdueDays = Math.max(
        0,
        Math.floor((today - due) / 86400000)
    );

    return {
        days: overdueDays,
        fine: overdueDays * 5
    };
}

function renderReturns() {
    const search = $("returnSearch").value.toLowerCase().trim();

    const filtered = issuedRecords.filter(record =>
        record.student_name.toLowerCase().includes(search) ||
        record.book_title.toLowerCase().includes(search)
    );

    if (filtered.length === 0) {
        $("returnsTable").innerHTML = `
            <tr>
                <td colspan="7" class="empty-cell">
                    No issue records found
                </td>
            </tr>
        `;
        return;
    }

    $("returnsTable").innerHTML = filtered.map(record => {
        const returned = Boolean(record.actual_return_date);

        const currentFine = returned
            ? Number(record.fine || 0)
            : calculateCurrentFine(record.return_date).fine;

        const overdue = !returned &&
            calculateCurrentFine(record.return_date).days > 0;

        let status = "Issued";
        let statusClass = "status-issued";

        if (returned) {
            status = "Returned";
            statusClass = "status-returned";
        } else if (overdue) {
            status = "Overdue";
            statusClass = "status-overdue";
        }

        return `
            <tr>
                <td><strong>${escapeHTML(record.student_name)}</strong></td>

                <td>${escapeHTML(record.book_title)}</td>

                <td>${escapeHTML(record.issue_date)}</td>

                <td>${escapeHTML(record.return_date)}</td>

                <td>
                    <span class="status-badge ${statusClass}">
                        ${status}
                    </span>
                </td>

                <td>₹${currentFine}</td>

                <td>
                    ${
                        returned
                            ? '<span class="status-badge status-returned">Completed</span>'
                            : `
                                <button class="primary-btn"
                                    data-return-book="${record.id}"
                                    style="padding:8px 11px;font-size:10px;">
                                    Return
                                </button>
                            `
                    }
                </td>
            </tr>
        `;
    }).join("");
}

$("returnSearch").addEventListener("input", renderReturns);

// RETURN ACTION

$("returnsTable").addEventListener("click", async (event) => {
    const button = event.target.closest("[data-return-book]");

    if (!button) return;

    const id = button.dataset.returnBook;

    if (!confirm("Confirm that this book has been returned?")) {
        return;
    }

    try {
        const result = await apiRequest(`/books/return/${id}`, {
            method: "POST"
        });

        showToast(
            `Returned! Fine: ₹${result.fine}. Overdue days: ${result.overdue_days}`
        );

        await loadAllData();

    } catch (error) {
        showToast(error.message, "error");
    }
});

// =========================================
// MODAL CLOSE EVENTS
// =========================================

document.querySelectorAll("[data-close]").forEach(button => {
    button.addEventListener("click", () => {
        closeModal(button.dataset.close);
    });
});

document.querySelectorAll(".modal").forEach(modal => {
    modal.addEventListener("click", (event) => {
        if (event.target === modal) {
            modal.classList.remove("show");
        }
    });
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        document.querySelectorAll(".modal.show").forEach(modal => {
            modal.classList.remove("show");
        });

        closeSidebar();
    }
});

// =========================================
// REFRESH BUTTON
// =========================================

$("refreshBtn").addEventListener("click", async () => {
    const button = $("refreshBtn");

    button.querySelector("i").classList.add("fa-spin");

    try {
        await loadAllData();
        showToast("Library data refreshed");
    } finally {
        button.querySelector("i").classList.remove("fa-spin");
    }
});

// =========================================
// INITIAL APPLICATION STATE
// =========================================

$("app").classList.add("hidden");
$("loginScreen").classList.remove("hidden");

console.log("LibraDesk frontend initialized successfully.");
