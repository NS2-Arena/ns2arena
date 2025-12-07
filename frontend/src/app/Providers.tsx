import { useTheme } from "@heroui/use-theme";
import { type PropsWithChildren } from "react";
import { BrowserRouter } from "react-router";

export const Providers = (props: PropsWithChildren) => {
  useTheme();

  return <BrowserRouter>{props.children}</BrowserRouter>;
};
