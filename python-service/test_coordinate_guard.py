import unittest
from collections import namedtuple

from coordinate_guard import align_pointer

Point = namedtuple("Point", "x y")


class FakeGui:
    def __init__(self, start=(10, 10), move_error=(0, 0)):
        self.current = start
        self.move_error = move_error
        self.moves = []

    def size(self):
        return 100, 80

    def position(self):
        return Point(self.current[0], self.current[1])

    def moveTo(self, x, y, duration=0):
        self.moves.append((x, y))
        self.current = (x + self.move_error[0], y + self.move_error[1])


class CoordinateGuardTests(unittest.TestCase):
    def test_repositions_cursor_and_confirms_alignment(self):
        gui = FakeGui(start=(5, 8))
        result = align_pointer(gui, 40, 30)
        self.assertTrue(result["aligned"])
        self.assertEqual(result["initialPosition"], {"x": 5, "y": 8})
        self.assertEqual(result["targetPosition"], {"x": 40, "y": 30})
        self.assertEqual(result["actualPosition"], {"x": 40, "y": 30})
        self.assertEqual(result["initialDriftPx"], 41.34)

    def test_retries_small_systematic_pointer_error(self):
        gui = FakeGui(start=(5, 8), move_error=(-2, 1))
        result = align_pointer(gui, 40, 30, tolerance_px=1)
        self.assertTrue(result["aligned"])
        self.assertTrue(result["recalibrated"])
        self.assertEqual(result["attempts"], 2)
        self.assertEqual(gui.moves[-1], (42, 29))

    def test_refuses_targets_outside_desktop_bounds(self):
        with self.assertRaisesRegex(ValueError, "outside the desktop"):
            align_pointer(FakeGui(), 100, 30)

    def test_reports_persistent_misalignment(self):
        class StuckGui(FakeGui):
            def moveTo(self, x, y, duration=0):
                self.moves.append((x, y))

        result = align_pointer(StuckGui(), 40, 30, max_attempts=2)
        self.assertFalse(result["aligned"])
        self.assertEqual(result["attempts"], 2)


if __name__ == "__main__":
    unittest.main()
