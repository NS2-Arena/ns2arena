import {
  Button,
  Link,
  Navbar,
  NavbarBrand,
  NavbarContent,
  NavbarItem,
} from "@heroui/react";
import { DarkModeButton } from "features/darkmode/components/DarkModeButton";
import { useLocation } from "react-router";

export const AcmeLogo = () => {
  return (
    <svg fill="none" height="36" viewBox="0 0 32 32" width="36">
      <path
        clipRule="evenodd"
        d="M17.6482 10.1305L15.8785 7.02583L7.02979 22.5499H10.5278L17.6482 10.1305ZM19.8798 14.0457L18.11 17.1983L19.394 19.4511H16.8453L15.1056 22.5499H24.7272L19.8798 14.0457Z"
        fill="currentColor"
        fillRule="evenodd"
      />
    </svg>
  );
};

interface NavBarItem {
  text: string;
  href: string;
}

const navBarItems: NavBarItem[] = [
  { text: "Play Now", href: "/" },
  { text: "Server Browser", href: "/browser" },
  { text: "Find a Scrim", href: "/scrims" },
];

export const Header = () => {
  const location = useLocation();

  return (
    <Navbar>
      <NavbarBrand>
        <AcmeLogo />
        <p className="font-bold text-inherit">NS2 Arena</p>
      </NavbarBrand>
      <NavbarContent className="flex" justify="center">
        {navBarItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <NavbarItem isActive={isActive} key={item.text}>
              <Link
                aria-current={isActive ? "page" : undefined}
                color={isActive ? undefined : "foreground"}
                href={item.href}
              >
                {item.text}
              </Link>
            </NavbarItem>
          );
        })}
      </NavbarContent>
      <NavbarContent justify="end">
        <NavbarItem className="flex">
          <Link href="#">Login</Link>
        </NavbarItem>
        <NavbarItem>
          <Button as={Link} color="primary" href="#" variant="flat">
            Sign Up
          </Button>
        </NavbarItem>
        <NavbarItem>
          <DarkModeButton />
        </NavbarItem>
      </NavbarContent>
    </Navbar>
  );
};
