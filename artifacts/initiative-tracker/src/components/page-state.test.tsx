import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageLoading, PageError, CardSkeletonGrid, InlineLoading } from "./page-state";

describe("PageLoading", () => {
  it("renders the default loading label", () => {
    render(<PageLoading />);
    expect(screen.getAllByRole("status")[0]).toHaveTextContent("Loading...");
  });

  it("renders a custom label", () => {
    render(<PageLoading label="Fetching initiatives..." />);
    expect(screen.getByText("Fetching initiatives...")).toBeInTheDocument();
  });
});

describe("PageError", () => {
  it("renders default title and description", () => {
    render(<PageError />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText("We couldn't load this data. Please try refreshing the page."),
    ).toBeInTheDocument();
  });

  it("renders a custom title and description", () => {
    render(<PageError title="Failed to load" description="Try again later." />);
    expect(screen.getByText("Failed to load")).toBeInTheDocument();
    expect(screen.getByText("Try again later.")).toBeInTheDocument();
  });
});

describe("CardSkeletonGrid", () => {
  it("renders the default number of skeleton cards", () => {
    const { container } = render(<CardSkeletonGrid />);
    expect(container.querySelectorAll(":scope > div > div")).toHaveLength(6);
  });

  it("renders a custom number of skeleton cards", () => {
    const { container } = render(<CardSkeletonGrid count={3} />);
    expect(container.querySelectorAll(":scope > div > div")).toHaveLength(3);
  });
});

describe("InlineLoading", () => {
  it("renders the default loading label", () => {
    render(<InlineLoading />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders a custom label", () => {
    render(<InlineLoading label="Loading history..." />);
    expect(screen.getByText("Loading history...")).toBeInTheDocument();
  });
});
