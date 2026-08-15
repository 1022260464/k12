from pydantic import BaseModel, ConfigDict


def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(word.capitalize() for word in rest)


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class ApiResponse[T](ApiModel):
    code: int
    message: str
    data: T | None = None

    @classmethod
    def ok(cls, data: T) -> "ApiResponse[T]":
        return cls(code=200, message="ok", data=data)
