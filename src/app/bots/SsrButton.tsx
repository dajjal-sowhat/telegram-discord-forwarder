'use client';
import React, {ComponentProps, useState} from 'react';
import {Button, ButtonProps, PolymorphicComponentProps} from "@mantine/core";
import {useRouter} from "next/navigation";

function SsrButton(props: PolymorphicComponentProps<"button", ButtonProps> & {confirm?: boolean}) {
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    return (
        <Button
            {...props}
            loading={loading}
            onClick={() => {
                const func = props.onClick as ()=>Promise<any>;
                if (!func) return;

                if (props.confirm && !window.confirm("Are you sure about this?")) return;

                setLoading(true);
                func()?.finally?.(()=>{
                    setLoading(false);
                    router.refresh();
                    setTimeout(()=>{
                        router.refresh();
                    }, 1000)
                })
            }}
        />
    );
}

export default SsrButton;