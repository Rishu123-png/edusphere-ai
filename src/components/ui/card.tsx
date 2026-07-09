import * as React from "react"
import { cn } from "@/lib/utils"
export const Card = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("card-soft p-5", className)} {...props} />
export const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("mb-3", className)} {...props} />
export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h3 className={cn("text-lg font-semibold", className)} {...props} />
export const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div className={cn("", className)} {...props} />
