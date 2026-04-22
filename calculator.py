def add(a: float, b: float) -> float:
    """2つの数値を加算して返す。

    Args:
        a: 被加数。
        b: 加数。

    Returns:
        a と b の和。
    """
    return a + b


def subtract(a: float, b: float) -> float:
    """2つの数値を減算して返す。

    Args:
        a: 被減数。
        b: 減数。

    Returns:
        a から b を引いた差。
    """
    return a - b


def multiply(a: float, b: float) -> float:
    """2つの数値を乗算して返す。

    Args:
        a: 被乗数。
        b: 乗数。

    Returns:
        a と b の積。
    """
    return a * b


def divide(a: float, b: float) -> float:
    """2つの数値を除算して返す。

    Args:
        a: 被除数。
        b: 除数。0 を指定してはならない。

    Returns:
        a を b で割った商。

    Raises:
        ValueError: b が 0 の場合。
    """
    if b == 0:
        raise ValueError("Cannot divide by zero")
    return a / b


def calculate(a: float, op: str, b: float) -> float:
    """演算子文字列に基づいて2つの数値を計算して返す。

    対応する演算子は "+"、"-"、"*"、"/" の4種類。
    各演算子はそれぞれ add、subtract、multiply、divide 関数に委譲する。

    Args:
        a: 演算の左辺値。
        op: 演算子を表す文字列。"+"、"-"、"*"、"/" のいずれか。
        b: 演算の右辺値。

    Returns:
        演算結果の数値。

    Raises:
        ValueError: op が未対応の演算子の場合、または op が "/" かつ b が 0 の場合。
    """
    ops = {"+": add, "-": subtract, "*": multiply, "/": divide}
    if op not in ops:
        raise ValueError(f"Unknown operator: {op}")
    return ops[op](a, b)


if __name__ == "__main__":
    examples = [
        (10, "+", 5),
        (10, "-", 3),
        (4, "*", 7),
        (20, "/", 4),
    ]
    for a, op, b in examples:
        print(f"{a} {op} {b} = {calculate(a, op, b)}")
