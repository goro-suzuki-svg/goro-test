import unittest
from calculator import add, subtract, multiply, divide, calculate


class TestAdd(unittest.TestCase):
    def test_positive_numbers(self):
        self.assertEqual(add(3, 4), 7)

    def test_negative_numbers(self):
        self.assertEqual(add(-2, -5), -7)

    def test_mixed_sign(self):
        self.assertEqual(add(-3, 5), 2)

    def test_floats(self):
        self.assertAlmostEqual(add(1.1, 2.2), 3.3)

    def test_zero(self):
        self.assertEqual(add(0, 0), 0)


class TestSubtract(unittest.TestCase):
    def test_positive_result(self):
        self.assertEqual(subtract(10, 3), 7)

    def test_negative_result(self):
        self.assertEqual(subtract(3, 10), -7)

    def test_negative_numbers(self):
        self.assertEqual(subtract(-4, -6), 2)

    def test_floats(self):
        self.assertAlmostEqual(subtract(5.5, 2.2), 3.3)

    def test_zero(self):
        self.assertEqual(subtract(0, 0), 0)


class TestMultiply(unittest.TestCase):
    def test_positive_numbers(self):
        self.assertEqual(multiply(3, 4), 12)

    def test_negative_numbers(self):
        self.assertEqual(multiply(-3, -4), 12)

    def test_mixed_sign(self):
        self.assertEqual(multiply(-3, 4), -12)

    def test_floats(self):
        self.assertAlmostEqual(multiply(2.5, 4.0), 10.0)

    def test_zero(self):
        self.assertEqual(multiply(0, 100), 0)

    def test_one(self):
        self.assertEqual(multiply(7, 1), 7)


class TestDivide(unittest.TestCase):
    def test_exact_division(self):
        self.assertEqual(divide(10, 2), 5.0)

    def test_float_result(self):
        self.assertAlmostEqual(divide(1, 3), 0.3333333333)

    def test_negative_dividend(self):
        self.assertEqual(divide(-10, 2), -5.0)

    def test_negative_divisor(self):
        self.assertEqual(divide(10, -2), -5.0)

    def test_both_negative(self):
        self.assertEqual(divide(-10, -2), 5.0)

    def test_divide_by_zero_raises(self):
        with self.assertRaises(ValueError):
            divide(5, 0)

    def test_divide_by_zero_message(self):
        with self.assertRaises(ValueError) as ctx:
            divide(5, 0)
        self.assertIn("zero", str(ctx.exception).lower())


class TestCalculate(unittest.TestCase):
    def test_addition(self):
        self.assertEqual(calculate(10, "+", 5), 15)

    def test_subtraction(self):
        self.assertEqual(calculate(10, "-", 3), 7)

    def test_multiplication(self):
        self.assertEqual(calculate(4, "*", 7), 28)

    def test_division(self):
        self.assertEqual(calculate(20, "/", 4), 5.0)

    def test_unknown_operator_raises(self):
        with self.assertRaises(ValueError):
            calculate(1, "%", 2)

    def test_unknown_operator_message(self):
        with self.assertRaises(ValueError) as ctx:
            calculate(1, "^", 2)
        self.assertIn("^", str(ctx.exception))

    def test_empty_operator_raises(self):
        with self.assertRaises(ValueError):
            calculate(1, "", 2)

    def test_divide_by_zero_propagates(self):
        with self.assertRaises(ValueError):
            calculate(5, "/", 0)

    def test_negative_operands(self):
        self.assertEqual(calculate(-3, "*", -4), 12)

    def test_float_operands(self):
        self.assertAlmostEqual(calculate(1.5, "+", 2.5), 4.0)


if __name__ == "__main__":
    unittest.main()
