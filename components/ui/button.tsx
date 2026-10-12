import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
const buttonVariants = cva("btn", {
  variants: {
    variant: {
      default: "primary",
      outline: "outline",
      ghost: "ghost",
      secondary: "secondary",
      destructive: "danger",
      link: "link",
    },
    size: { default: "", sm: "small", lg: "large", icon: "icon-button" },
  },
  defaultVariants: { variant: "default", size: "default" },
});
export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, type = "button", ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        type={asChild ? undefined : type}
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  },
);
export { Button, buttonVariants };
