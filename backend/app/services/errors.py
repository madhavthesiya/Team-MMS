"""Domain errors raised by services; main.py turns them into JSON responses."""


class DomainError(Exception):
    status_code = 400


class NotFoundError(DomainError):
    status_code = 404


class ConflictError(DomainError):
    status_code = 409


class InvalidInputError(DomainError):
    status_code = 422
