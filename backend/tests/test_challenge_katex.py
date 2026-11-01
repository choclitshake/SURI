import os
import sys
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
CHALLENGE = os.path.join(ROOT, "knowledge_base", "challenge")
if CHALLENGE not in sys.path:
    sys.path.insert(0, CHALLENGE)

from katex_format import ascii_to_katex, katexify_prose, outside_math_is_clean, to_blank, to_value  # noqa: E402


class ValueTests(unittest.TestCase):
    def test_implicit_multiplication_and_powers(self):
        self.assertEqual(to_value("2*x + 7"), "2x + 7")
        self.assertEqual(to_value("x^2 + 5*x + 6"), "x^{2} + 5x + 6")
        self.assertEqual(to_value("(x+2)*(x+3)"), "(x+2)(x+3)")
        self.assertEqual(to_value("x^(1/2)"), "x^{\\frac{1}{2}}")

    def test_fractions_and_roots(self):
        self.assertEqual(to_value("3/4"), "\\frac{3}{4}")
        self.assertEqual(to_value("(x+1)/2"), "\\frac{x+1}{2}")
        self.assertEqual(to_value("2*sqrt(3)"), "2\\sqrt{3}")
        self.assertEqual(to_value("nthRoot(8, 3)"), "\\sqrt[3]{8}")

    def test_numbers_and_equations(self):
        self.assertEqual(to_value("12"), "12")
        self.assertEqual(to_value("x = 14"), "x = 14")
        self.assertEqual(to_value("3*4"), "3 \\cdot 4")
        self.assertEqual(to_value("-6, 5"), "-6, 5")

    def test_no_dollars_in_values(self):
        self.assertNotIn("$", to_value("$2*x$"))


class BlankTests(unittest.TestCase):
    def test_blank_sits_outside_math_spans(self):
        self.assertEqual(to_blank("2*x = ___"), "$2x =$ ?")
        self.assertEqual(to_blank("___ = 35"), "? $= 35$")
        self.assertEqual(to_blank("2*(w + ___ + w) = 50"), "$2(w +$ ? $+ w) = 50$")
        self.assertEqual(to_blank("___"), "?")

    def test_each_half_is_balanced_so_the_practice_page_needs_no_repair(self):
        for src in ("2*x = ___", "___ = 35", "2*(w + ___ + w) = 50", "x = ___"):
            before, after = to_blank(src).split("?")
            self.assertEqual(before.count("$") % 2, 0, src)
            self.assertEqual(after.count("$") % 2, 0, src)

    def test_words_go_in_text(self):
        self.assertEqual(to_blank("Most expensive = ___"), "$\\text{Most expensive} =$ ?")

    def test_needs_exactly_one_blank(self):
        with self.assertRaises(ValueError):
            to_blank("x = 4")
        with self.assertRaises(ValueError):
            to_blank("___ + ___ = 4")


class ProseTests(unittest.TestCase):
    def test_wraps_equations_and_variables(self):
        self.assertEqual(katexify_prose("Let x be the number."), "Let $x$ be the number.")
        self.assertEqual(katexify_prose("Solve 2*x + 7 = 35 now."), "Solve $2x + 7 = 35$ now.")
        self.assertEqual(katexify_prose("Write an expression for x + 4."), "Write an expression for $x + 4$.")

    def test_leaves_plain_text_numbers_and_article(self):
        text = "She has 20 coins and buys a notebook for 15 pesos."
        self.assertEqual(katexify_prose(text), text)

    def test_converts_existing_spans(self):
        self.assertEqual(katexify_prose("Find $2*x + 3$."), "Find $2x + 3$.")

    def test_underscore_cue_in_prose_is_kept_and_allowed(self):
        text = "Write the equation $2x + 7 =$ ___ in the box."
        self.assertEqual(katexify_prose(text), text)
        self.assertTrue(outside_math_is_clean(text))

    def test_underscore_cue_inside_math_is_escaped(self):
        self.assertEqual(katexify_prose("Fill in $x = ___$."), "Fill in $x = \\_\\_\\_$.")

    def test_wraps_bare_latex_commands(self):
        self.assertEqual(katexify_prose("Package A by \\frac{1}{20}"), "Package A by $\\frac{1}{20}$")
        self.assertEqual(katexify_prose("Find \\sqrt{12} now"), "Find $\\sqrt{12}$ now")

    def test_subscript_names_become_math(self):
        out = katexify_prose("Let A_total be the area.")
        self.assertEqual(out, "Let $A_{\\text{total}}$ be the area.")
        self.assertTrue(outside_math_is_clean(out))

    def test_idempotent(self):
        once = katexify_prose("Let x be the width. Then 2*(w + 5) = 50.")
        self.assertEqual(katexify_prose(once), once)

    def test_clean_check(self):
        self.assertTrue(outside_math_is_clean("Find $2x$ now."))
        self.assertFalse(outside_math_is_clean("Find 2*x now."))
        self.assertFalse(outside_math_is_clean("Unbalanced $x"))


class RoundTripTests(unittest.TestCase):
    """The stored LaTeX must still evaluate to the same value through the generator's answer parser."""

    @classmethod
    def setUpClass(cls):
        import generate_challenge_bank as gen
        cls.gen = gen
        cls.v = gen.Verifier()

    @classmethod
    def tearDownClass(cls):
        cls.v.close()

    def test_round_trip_values(self):
        scope = {"x": 3, "y": 5, "w": 7}
        for src in ["2*x + 7", "x^2 + 5*x + 6", "(x+2)*(x+3)", "3/4", "(x+1)/2", "2*sqrt(3)", "nthRoot(8, 3)",
                    "x^(1/2) * 4", "12", "50 - 2*x", "(2*x + 3)^2", "10*x + 5*(20-x)"]:
            want = self.v.eval(src, scope)
            got = self.v.eval(self.gen.to_ascii(to_value(src)), scope)
            self.assertAlmostEqual(want, got, places=6, msg=f"{src} -> {to_value(src)}")


if __name__ == "__main__":
    unittest.main()
