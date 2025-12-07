import { MoonIcon, SunIcon } from "@heroicons/react/16/solid";
import { Button } from "@heroui/react";
import { useTheme } from "@heroui/use-theme";

export const DarkModeButton = () => {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  const toggleDarkMode = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <Button
      color="primary"
      isIconOnly
      onPress={toggleDarkMode}
      aria-label={`switch to ${isDark ? "light" : "dark"} mode`}
      variant="faded"
    >
      {isDark ? (
        <SunIcon className="w-7 h-7" />
      ) : (
        <MoonIcon className="w-7 h-7" />
      )}
    </Button>
  );
};
