"""Content and local-link checks for the grade 10 pages (no external dependencies)."""
import json
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parent.parent
COURSE = json.loads((ROOT / "scripts/course.json").read_text())
PAGES = [
    "index.html", "Программисты.html", "ИОР-Информатика.html", "!Index/index.html",
    "introduction.html", "arrays.html", "computer.html", "textbook.html",
    "saved.html", "safety.html", "appendix.html",
] + [f"lessons/{i:02}.html" for i in range(1, 16)]


class PageParser(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.links = []
        self.ids = []
        self.h1_count = 0
        self.images = []
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if tag == "h1":
            self.h1_count += 1
        if tag == "img":
            self.images.append(attrs)
        for key in ("href", "src"):
            if key in attrs:
                self.links.append(attrs[key])


class CourseTests(unittest.TestCase):
    def test_full_textbook_outline(self):
        self.assertEqual([x["id"] for x in COURSE], list(range(1, 16)))
        self.assertEqual([sum(x["group"] == g for x in COURSE) for g in range(3)], [2, 5, 8])
        self.assertEqual([x["page"] for x in COURSE], [8, 11, 22, 31, 36, 48, 54, 59, 68, 76, 79, 84, 91, 99, 109])

    def test_every_lesson_has_complete_content(self):
        for lesson in COURSE:
            with self.subTest(lesson=lesson["id"]):
                self.assertGreaterEqual(len(lesson["theory"]), 3)
                self.assertGreaterEqual(len(lesson["tasks"]), 3)
                self.assertTrue(lesson["answer"])
                self.assertIn(lesson["quiz"]["correct"], range(len(lesson["quiz"]["options"])))
                text = (ROOT / f'lessons/{lesson["id"]:02}.html').read_text()
                self.assertIn(lesson["title"], text)
                self.assertIn(f'#page={lesson["page"] + 1}', text)
                for section in ("theory", "example", "practice", "quiz"):
                    self.assertIn(f'id="{section}"', text)
                self.assertIn(f'data-complete="{lesson["id"]}"', text)

    def test_local_links_and_fragments(self):
        parsed = {}
        for page in PAGES:
            path = ROOT / page
            parser = PageParser(path.read_text())
            for raw in parser.links:
                with self.subTest(page=page, link=raw):
                    url = urlsplit(raw)
                    if url.scheme or url.netloc:
                        continue
                    dest = (path.parent / unquote(url.path)).resolve() if url.path else path
                    self.assertTrue(dest.is_relative_to(ROOT), f"Outside repository: {dest}")
                    self.assertTrue(dest.is_file(), f"Missing: {dest}")
                    if url.fragment and dest.suffix == ".html":
                        if dest not in parsed:
                            parsed[dest] = PageParser(dest.read_text())
                        self.assertIn(unquote(url.fragment), parsed[dest].ids)

    def test_accessible_page_structure(self):
        for page in PAGES:
            with self.subTest(page=page):
                text = (ROOT / page).read_text()
                parsed = PageParser(text)
                self.assertEqual(parsed.h1_count, 1)
                self.assertEqual(len(parsed.ids), len(set(parsed.ids)), "Duplicate IDs")
                self.assertIn('<html lang="ru">', text)
                self.assertIn('name="viewport"', text)
                self.assertIn('id="main"', text)
                for image in parsed.images:
                    self.assertIn("alt", image)

    def test_self_contained_assets(self):
        for page in PAGES:
            text = (ROOT / page).read_text()
            self.assertNotIn("fonts.googleapis.com", text)
            self.assertNotIn("jquery", text)
            self.assertNotIn('href="#"', text)
        self.assertTrue((ROOT / "files/informatika-10.pdf").read_bytes().startswith(b"%PDF"))


if __name__ == "__main__":
    unittest.main()
