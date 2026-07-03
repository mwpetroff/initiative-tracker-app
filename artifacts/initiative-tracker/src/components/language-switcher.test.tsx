import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import i18n, { LANGUAGE_STORAGE_KEY } from "@/i18n";
import { LanguageSwitcher } from "./language-switcher";
import { PageLoading } from "./page-state";

const mutateMock = vi.fn();

vi.mock("@workspace/api-client-react", () => ({
  useUpdateSettings: () => ({ mutate: mutateMock }),
  getGetSettingsQueryKey: () => ["/api/settings"],
}));

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

beforeEach(async () => {
  mutateMock.mockClear();
  localStorage.clear();
  await act(async () => {
    await i18n.changeLanguage("en");
  });
});

afterEach(async () => {
  await act(async () => {
    await i18n.changeLanguage("en");
  });
  localStorage.clear();
});

describe("LanguageSwitcher", () => {
  it("renders both language options with English active by default", () => {
    renderWithQueryClient(<LanguageSwitcher />);
    const enButton = screen.getByRole("button", { name: "EN" });
    const jaButton = screen.getByRole("button", { name: "日本語" });
    expect(enButton).toHaveAttribute("aria-pressed", "true");
    expect(jaButton).toHaveAttribute("aria-pressed", "false");
  });

  it("switches to Japanese and persists the choice in localStorage", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<LanguageSwitcher />);

    await user.click(screen.getByRole("button", { name: "日本語" }));

    expect(i18n.language).toBe("ja");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("ja");
    expect(screen.getByRole("button", { name: "日本語" })).toHaveAttribute("aria-pressed", "true");
  });

  it("saves the choice to the server", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<LanguageSwitcher />);

    await user.click(screen.getByRole("button", { name: "日本語" }));

    expect(mutateMock).toHaveBeenCalledWith({ data: { language: "ja" } });
  });

  it("does not call the server when the current language is re-selected", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<LanguageSwitcher />);

    await user.click(screen.getByRole("button", { name: "EN" }));

    expect(mutateMock).not.toHaveBeenCalled();
    expect(i18n.language).toBe("en");
  });

  it("switches back to English and persists it", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(<LanguageSwitcher />);

    await user.click(screen.getByRole("button", { name: "日本語" }));
    await user.click(screen.getByRole("button", { name: "EN" }));

    expect(i18n.language).toBe("en");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("en");
  });

  it("translates UI strings when the language changes", async () => {
    const user = userEvent.setup();
    renderWithQueryClient(
      <div>
        <LanguageSwitcher />
        <PageLoading />
      </div>,
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "日本語" }));

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });
});
