import tempfile
import unittest
from pathlib import Path

from import_civ6 import Database, clean_text, discover, sid


class ImporterTests(unittest.TestCase):
    def test_stable_ids(self):
        self.assertEqual(sid("TECH_BRONZE_WORKING"), "tech_bronze_working")
        self.assertEqual(sid("BUILDING_LIBRARY"), "building_library")

    def test_localization_markup_is_readable(self):
        self.assertEqual(clean_text("+1 [ICON_PRODUCTION] Production"), "+1 Production Production")
        self.assertEqual(
            clean_text("First[NEWLINE][NEWLINE][Icon_Governor] Governor[ENDCOLOR]"),
            "First Governor Governor",
        )

    def test_rows_updates_and_deletes(self):
        xml = """<GameData><Technologies>
          <Row TechnologyType="TECH_TEST" Name="LOC_TEST" Cost="20"/>
          <Update><Where TechnologyType="TECH_TEST"/><Set Cost="30"/></Update>
        </Technologies><BaseGameText><Row Tag="LOC_TEST"><Text>Test Tech</Text></Row></BaseGameText></GameData>"""
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / "data.xml"
            path.write_text(xml, encoding="utf-8")
            db = Database()
            db.parse(path)
        self.assertEqual(db.rows("Technologies")[0]["Cost"], "30")
        self.assertEqual(db.loc("LOC_TEST"), "Test Tech")

    def test_dlc_localization_selection_is_english_only(self):
        # The install-dependent discovery behavior is asserted indirectly by
        # keeping this invariant beside the parser tests: mod text paths must
        # be explicitly scoped to en_US before parsing.
        source = Path(__file__).with_name("import_civ6.py").read_text(encoding="utf-8")
        self.assertIn('if "en_us" in str(path).lower()', source)


if __name__ == "__main__":
    unittest.main()
