import * as React from "react";
import { fieldLabelClasses } from "./form";
import { mergeClasses } from "./classes";

const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => (
  <label
    ref={ref}
    data-balsa="label"
    className={mergeClasses(fieldLabelClasses, "peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)}
    {...props}
  />
));
Label.displayName = "Label";

export { Label };
