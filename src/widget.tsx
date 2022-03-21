import { ReactWidget } from '@jupyterlab/apputils';
import React, { useEffect, useContext, useState, useRef } from 'react';
import { UserContext } from './context';
import { requestAPI } from './handler';

import {
    TextField, Box, Stack, Divider, Paper, Avatar,
    Button, Collapse, Alert, AlertTitle, Link
} from '@mui/material';

import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DehazeOutlinedIcon from '@mui/icons-material/DehazeOutlined';

import { ThemeProvider } from "@mui/material/styles";
import ButtonProgram from './program'
import FileList from './filelist'
import webdsTheme from './webds_theme';

import { green } from '@mui/material/colors';

const PACKRAT_WIDTH=225

interface TextFieldWithProgressProps {
    packrat: string;
    progress: number;
    color?: string;
}

function TextFieldWithProgress(
    props: TextFieldWithProgressProps
) {
    return (
        <Box sx={{ position: 'relative', display: 'inline-flex', mr: 1 }}>
            <Box
                sx={{
                    top: 0,
                    left: 0,
                    bottom: 0,
                    right: 0,
                    position: 'absolute',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'left',
                }}
            >
                <Paper sx={{ bgcolor: green[200], width: (props.progress * PACKRAT_WIDTH / 100), height: 39}} />
            </Box>

            <TextField
                value={props.packrat}
                id="outlined-size-small"
                size="small"
                sx={{ width: PACKRAT_WIDTH }}
            />
        </Box>
    );
}

type SeverityType = 'error' | 'info' | 'success' | 'warning';

export default function VerticalTabs(
    props: {
        onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    }
) {
    const [packrat, setPackrat] = useState("3318382");
    const [packratError, setPackratError] = useState(false);
    const [open, setOpen] = useState(false);
    const [filelist, setFileList] = useState([]);
    const [select, setSelect] = useState("");
    const [start, setStart] = useState(false);
    const [progress, setProgress] = useState(0);

    const [isAlert, setAlert] = useState(false);
    const messageRef = useRef("");
    const severityRef = useRef<SeverityType>('info');
    const resultRef = useRef("");
    const linkRef = React.useRef("");

    const context = useContext(UserContext);

    const fetchData = async () => {
        const data = await get_hex_list();
        console.log('data', data);
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        console.log(packrat);
        if (packrat === '') {
            setPackratError(true);
        }
        else if (isNaN(+Number(packrat))) {
            console.log("invalid!!");
            setPackratError(true);
        }
        else {
            setPackratError(false);
            context.packrat = packrat;
            console.log(context.packrat);
        }
    }, [packrat]);

    useEffect(() => {
        if (open) {
            fetchData();
        }
    }, [open]);

    useEffect(() => {
        if (open) {
            let file = select.split(".")[0].substr(2);
            console.log("onFileSelect:", file);
            setPackrat(file);
        }
    }, [select]);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setOpen(!open);
    };

    const handleUpload = (event: React.MouseEvent<HTMLElement>) => {
        (document.getElementById("icon-button-hex") as HTMLInputElement).value = "";
    }

    const handlFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        console.log(event);

        if (event.currentTarget.files) {
            upload_hex(event.currentTarget.files[0])
                .then((file) => {
                    console.log(file);
                    ////setLoading(false);
                })
                .catch(err => {
                    ////setLoading(false);
                    alert(err)
                });
        }
    }

    const onFileDelete = (file: string, index: number) => {
        console.log("onFileDelete:", file);
        delete_hex(file);
    };

    const onFileSelect = (file: string) => {
        setSelect(file);
        console.log("onFileSelect:", file);
    };

    const onStart = (start: any) => {
        console.log(start);
        if (start)
            setAlert(false);
        setStart(start);
        setOpen(false);
    };

    const onProgress = (progress: number) => {
        console.log(progress);
        setProgress(progress);
    };

    const onMessage = (severity: SeverityType, message: string, link: string) => {
        messageRef.current = message;
        severityRef.current = severity;
        resultRef.current = severity.toUpperCase();
        linkRef.current = link;

        console.log(severityRef.current);
        console.log(messageRef.current);
        console.log(resultRef.current);
        console.log(linkRef.current);

        setAlert(true);
    };

    const delete_hex = async (filename: string): Promise<string | undefined> => {
        console.log("delete_hex");
        let packratnum = filename.split(".")[0].substr(2);
        const dataToSend = { file: filename };

        console.log(packratnum);
        console.log(dataToSend);

        try {
            const reply = await requestAPI<any>('packrat/' + packratnum, {
                body: JSON.stringify(dataToSend),
                method: 'DELETE',
            });
            console.log(reply);
            await get_hex_list().then(list => {
                if (packrat == packratnum) {
                    if (list!.indexOf(filename) == -1) {
                        setPackrat("");
                    }
                }
            });

            return reply;
        } catch (error) {
            if (error) {
                return error.message
            }
        }
    }

    const get_hex_list = async (): Promise<string[] | undefined> => {
        try {
            const reply = await requestAPI<any>('packrat?extension=hex', {
                method: 'GET',
            });
            console.log(reply);

            let hexlist = reply["filelist"].map((value: string) => {
                let res = value.split("/");
                return res[1];
            });

            setFileList(hexlist);
            return hexlist;
        } catch (error) {
            console.log(error);
            setFileList([]);
            return error.message
        }
    }

    const upload_hex = async (file: File): Promise<string | undefined> => {
        console.log("upload_hex:", file);

        if (file) {
            ////setLoading(true);

            const formData = new FormData();
            formData.append("fileToUpload", file);

            console.log(formData);
            try {
                const reply = await requestAPI<any>('packrat', {
                    body: formData,
                    method: 'POST',
                });

                console.log(reply);

                let filename = reply['filename'];
                get_hex_list().then(() => { setSelect(filename) });
                return Promise.resolve(filename);
            } catch (error) {
                console.log(error);
                console.log(error.message);
                return Promise.reject(error.message);
            }
        }
    }

    return (
        <div>
            <ThemeProvider theme={webdsTheme}>
                <Collapse in={isAlert}>
                    <Alert severity={severityRef.current} onClose={() => setAlert(false)}>
                        <AlertTitle> {resultRef.current} </AlertTitle>
                        {messageRef.current}
                        <Link href={linkRef.current}>{linkRef.current}</Link>
                    </Alert>
                </Collapse>

                <Box sx={{
                    flexDirection: 'row',
                    display: 'flex',
                    justifyContent: 'center',
                    //alignItems: "center",
                    mt: 6
                }}>
                    <Stack spacing={1} sx={{
                        flexDirection: 'column',
                        display: 'flex',
                        mt: 5
                    }}>
                        <Button variant="text" onClick={handleClick}>
                            <Avatar sx={{ bgcolor: webdsTheme.palette.primary.light }} variant="rounded">
                            {open ?
                                <CloseIcon fontSize="large"/>
                                :
                                <DehazeOutlinedIcon fontSize="large"/>
                            }
                            </Avatar>
                        </Button>
                        {open &&
                        <div>
                            <input
                                accept=".hex"
                                id="icon-button-hex"
                                onChange={handlFileChange}
                                type="file"
                                hidden
                            />
                            <label htmlFor="icon-button-hex">
                                <Button variant="text" onClick={handleUpload} component="span">
                                    <Avatar sx={{ bgcolor: webdsTheme.palette.primary.light }} variant="rounded">
                                        <CloudUploadIcon fontSize="large"/>
                                    </Avatar>
                                </Button>
                            </label>
                        </div>
                        }
                    </Stack>

                    <Stack spacing={1} sx={{
                        flexDirection: 'column',
                        display: 'flex',
                        alignItems: "center",
                        width: 245
                    }}>
                        <Divider>
                            <Box sx={{ textAlign: 'center', m: 1, fontWeight: 600, fontSize: 16 }}>
                                {open ? "Hex Files" : "Packrat"}
                            </Box>
                        </Divider>

                        {open ?
                            <Paper variant="outlined" sx={{ m: 0, p: 0/*, minWidth: 192, minHeight: 42*/}}>
                                <FileList list={filelist} onDelete={onFileDelete} onSelect={onFileSelect} select={select}/>
                            </Paper>
                                :
                            start ? 
                            <TextFieldWithProgress packrat={packrat} progress={progress}/>
                                :
                            <TextField id="filled-basic"
                                value={packrat}
                                onChange={(e) => setPackrat(e.target.value)}
                                error={packratError}
                                size="small"
                                sx={{
                                    width: PACKRAT_WIDTH,
                                }}
                            />
                        }
                        <ButtonProgram title="Program" list={filelist} error={packratError}
                            onStart={onStart} onProgress={onProgress} onMessage={onMessage} />
                    </Stack>
                </Box>
            </ThemeProvider>
        </div>
    );

}

/**
* A Counter Lumino Widget that wraps a CounterComponent.
*/
export class ShellWidget extends ReactWidget {
    /**
    * Constructs a new CounterWidget.
    */
    constructor() {
        super();
        this.addClass('content-widget');
        console.log("TabPanelUiWidget is created!!!");
    }

    handleChangeFile(e: React.ChangeEvent<HTMLInputElement>) {
        console.log(e.currentTarget.files);
    }

    render(): JSX.Element {
        return <VerticalTabs onFileChange={this.handleChangeFile} />;
    }
}
