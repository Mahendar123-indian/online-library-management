
import unittest

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


class LibraryManagementTests(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        options = Options()
        options.add_argument("--headless=new")
        options.add_argument("--no-sandbox")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--window-size=1366,768")

        cls.driver = webdriver.Chrome(options=options)
        cls.wait = WebDriverWait(cls.driver, 15)

        cls.driver.get("http://localhost:3000")

    @classmethod
    def tearDownClass(cls):
        cls.driver.quit()

    def test_01_homepage_loads(self):
        self.assertIn("LibraDesk", self.driver.title)

        self.wait.until(
            EC.visibility_of_element_located((By.ID, "loginScreen"))
        )

        print("PASS: LibraDesk homepage loaded")

    def test_02_admin_login(self):
        username = self.wait.until(
            EC.visibility_of_element_located((By.ID, "username"))
        )

        password = self.driver.find_element(By.ID, "password")

        username.send_keys("admin")
        password.send_keys("admin123")

        self.driver.find_element(By.ID, "loginForm").find_element(
            By.CSS_SELECTOR, "button[type='submit']"
        ).click()

        self.wait.until(
            EC.visibility_of_element_located((By.ID, "app"))
        )

        self.wait.until(
            EC.invisibility_of_element_located((By.ID, "loginScreen"))
        )

        print("PASS: Admin login successful")

    def test_03_dashboard_loads(self):
        dashboard = self.wait.until(
            EC.visibility_of_element_located((By.ID, "dashboardPage"))
        )

        self.assertTrue(dashboard.is_displayed())

        print("PASS: Dashboard loaded successfully")

    def test_04_books_section(self):
        books_navigation = self.wait.until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, 'button[data-page="books"]')
            )
        )

        books_navigation.click()

        books_page = self.wait.until(
            EC.visibility_of_element_located((By.ID, "booksPage"))
        )

        self.assertTrue(books_page.is_displayed())

        print("PASS: Books section opened")

    def test_05_search_books(self):
        search = self.wait.until(
            EC.visibility_of_element_located((By.ID, "bookSearch"))
        )

        search.send_keys("Python")

        self.assertEqual(search.get_attribute("value"), "Python")

        print("PASS: Book search input works")


if __name__ == "__main__":
    unittest.main(verbosity=2)
