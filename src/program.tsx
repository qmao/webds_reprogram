import React, { useState, useContext, useEffect, useRef } from 'react';
import { requestAPI } from './handler';
import { UserContext } from './context';

import { Typography, Button } from '@mui/material';
import { WebDSService } from '@webds/service';

interface ButtonProps {
    title?: any;
    error: any;
    list: any;
    onStart: any;
    onProgress: any;
    onMessage: any;
    service: WebDSService;
}

declare global {
    var source: EventSource;
}


export default function ButtonProgram(props: ButtonProps) {
    const {title, error, onMessage } = props;
    const [disable, setDisable] = useState(false);
    const [progress, setProgress] = React.useState(0);
    const [isStart, setStart] = React.useState(false);

    const context = useContext(UserContext);
    const link = useRef("");

    interface ProgramResponse {
        status: string;
        message: string;
    }

    const eventHandler = (event: any) => {
        let obj = JSON.parse(event.data);
        //console.log(obj)

        if (obj.progress) {
            setProgress(obj.progress);
        }
        if (obj.status && obj.message) {
            setProgramStatus(false, obj.status == 'success', JSON.stringify(obj.message));
        }
    }

    const go = (file: string) => {
        setProgramStatus(true);
        globalThis.source = new window.EventSource('/webds/reprogram');
        console.log(globalThis.source);
        if (globalThis.source != null) {
            globalThis.source.addEventListener('reprogram', eventHandler, false);
        }
        else {
            console.log("event source is null");
        }
        start_program(file)
            .then(res => {
                setProgramStatus(true);
            })
            .catch((error) => {
                console.log(error, 'Promise error');
                setProgramStatus(false, false, error);
         })
    }

    useEffect(() => {
        props.onProgress(progress);
    }, [progress]);

    useEffect(() => {
        let file: string;

        props.onStart(isStart);

        if (isStart) {

            let match = props.list.find((element: string) => {
                if (element.includes(context.packrat)) {
                    return true;
                }
            });

            console.log(props.list);

            if (!match) {
                console.log("download hex from packrat server");
                file = context.packrat;
                start_fetch(file).then(res => {
                    go(res);
                })
                .catch((error) => {
                    console.log(error, 'Promise error');
                    setProgramStatus(false, false, error);
                })
            }
            else {
                file = context.packrat + "/" + match;
                if (file == "") {
                    setProgramStatus(false, false, "Please choose a HEX file");
                }
                go(file);
            }
        }
    }, [isStart]);

    const setProgramStatus = (start: boolean, status?: boolean, result?: string) => {
        if (start) {
            link.current = "";
        }
        else {
            console.log(result);
            show_result(status!, result || '');
            setStart(false);
            console.log(globalThis.source)
            if (globalThis.source != undefined && globalThis.source.addEventListener != null) {
                globalThis.source.removeEventListener('reprogram', eventHandler, false);
                globalThis.source.close();
                console.log("close event source");
            }
        }

        setProgress(0);
        setDisable(start);
    }

    const show_result = (pass: boolean, message: string) => {
        console.log("pass:", pass);

        onMessage(pass ? "success" : "error", message, link.current);

        console.log(pass);
    }

    const start_program = async (file_name: string): Promise<ProgramResponse | undefined> => {
        const action = "start";
        const dataToSend = {
            filename: file_name,
            action: action
        };

        console.log("filename:", file_name);

        try {
            const reply = await requestAPI<any>('reprogram', {
                body: JSON.stringify(dataToSend),
                method: 'POST',
            });
            console.log(reply);
            return Promise.resolve(reply);
        } catch (e) {
            console.error(
                `Error on POST ${dataToSend}.\n${e}`
            );
            return Promise.reject((e as Error).message);
        }
    }

    const start_fetch = async (packrat: string): Promise<string> => {
        console.log(packrat);
        let path = '';
        for (let value of ['ihex', 'hex']) {
            try {
                let files = await props.service.packrat.cache.addPackratFiles([value], Number(packrat!));
                console.log(files);
                path = packrat + "/PR" + packrat
                if (value == 'ihex')
                    path = path + '.ihex'
                path = path + '.hex'
                return Promise.resolve(path);
            }
            catch (error) {
                console.log(error);
            }
        }
        return Promise.resolve("Hex file not found");
    }

    return (
        <Button disabled={disable || error}
            color="primary"
            variant="contained"
            onClick={() => setStart(true)}
            sx={{ width: 150 }}>
            { isStart &&
            <Typography
                variant="caption"
                component="div"
                color="text.secondary"
                sx={{mr:1}}
            >
            {`${Math.round(progress)}%`}
            </Typography>
            }
            { title }
        </Button>
    );
}


