"""Avaliador aritmético seguro (sem `eval`).

Faz o parse da expressão com o módulo `ast` e avalia apenas nós numéricos e
operadores aritméticos. Qualquer outra construção (nomes, chamadas, atributos,
comprehensions) é rejeitada — evita execução de código arbitrário vindo do LLM
ou do usuário.
"""

from __future__ import annotations

import ast
import operator
from typing import Union

Number = Union[int, float]

# Limite de expoente para evitar travar o processo com algo como 10**10**10.
_MAX_EXPONENT = 100


class CalculatorError(ValueError):
    """Erro de avaliação de expressão aritmética."""


_BIN_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}

_UNARY_OPS = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
}


def evaluate_expression(expression: str) -> Number:
    """Avalia uma expressão aritmética simples com segurança.

    Aceita números, `+ - * / // % **`, parênteses e sinal unário. Levanta
    :class:`CalculatorError` para qualquer entrada inválida ou não permitida.
    """
    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError as exc:
        raise CalculatorError("sintaxe inválida") from exc
    return _eval(tree.body)


def _eval(node: ast.AST) -> Number:
    if isinstance(node, ast.Constant):
        # bool é subclasse de int — barramos para não aceitar True/False.
        if isinstance(node.value, bool) or not isinstance(node.value, (int, float)):
            raise CalculatorError("apenas números são permitidos")
        return node.value

    if isinstance(node, ast.UnaryOp):
        op = _UNARY_OPS.get(type(node.op))
        if op is None:
            raise CalculatorError("operador unário não suportado")
        return op(_eval(node.operand))

    if isinstance(node, ast.BinOp):
        op = _BIN_OPS.get(type(node.op))
        if op is None:
            raise CalculatorError("operador não suportado")
        left, right = _eval(node.left), _eval(node.right)
        if isinstance(node.op, ast.Pow) and abs(right) > _MAX_EXPONENT:
            raise CalculatorError("expoente muito grande")
        try:
            return op(left, right)
        except ZeroDivisionError as exc:
            raise CalculatorError("divisão por zero") from exc

    raise CalculatorError("expressão não permitida")
