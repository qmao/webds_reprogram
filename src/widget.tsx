import { ReactWidget } from '@jupyterlab/apputils';
import React, { useEffect, useContext, useState, useRef } from 'react';
import { UserContext } from './context';
import { requestAPI } from './handler';

import {
    TextField, Box, Stack, Paper, Avatar,
    Button, Collapse, Alert, AlertTitle, Link, Typography
} from '@mui/material';

import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DehazeOutlinedIcon from '@mui/icons-material/DehazeOutlined';

import { ThemeProvider } from "@mui/material/styles";
import ButtonProgram from './program'
import FileList from './filelist'
import { WebDSService } from '@webds/service';
import { green } from '@mui/material/colors';

const PACKRAT_WIDTH = 225;
const HEIGHT_CONTROLS = 100;

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
		service: WebDSService;
    }
) {
    const [packrat, setPackrat] = useState("3318382");
    const [packratError, setPackratError] = useState(false);
    const [open, setOpen] = useState(false);
    const [filelist, setFileList] = useState<string[]>([]);
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
        const data = await get_lists();
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
        }
    }, [packrat]);

    useEffect(() => {
        if (open) {
            fetchData();
        }
    }, [open]);

    useEffect(() => {
        if (open) {
            let regex = /PR\d+/g;
            let packrat_number = select.match(regex);
            if (packrat_number) {
                setPackrat(packrat_number[0].substr(2));
            }
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
            upload_file(event.currentTarget.files[0])
                .then(() => {
                    console.log("upload file done");
                    ////setLoading(false);
                })
                .catch(error => {
                    ////setLoading(false);
                    onMessage('error', error, '');
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
            const url = `packrat/${packratnum}/${filename}`;
            const reply = await requestAPI<any>(url, {method: 'DELETE'});
            console.log(reply);
            await get_lists().then(list => {
                if (packrat == packratnum) {
                    if (list!.indexOf(filename) == -1) {
                        setPackrat("");
                        setSelect("");
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


    const get_list = async (exetension: string): Promise<string[] | undefined> => {
        try {

            const reply = await requestAPI<any>('packrat?extension=' + exetension, {
                method: 'GET',
            });
            console.log(reply);

            let list = reply["filelist"].map((value: string) => {
                let res = value.split("/");
                return res[1];
            });
            return Promise.resolve(list);
        } catch (error) {
            console.log(error);
            return Promise.reject(error.message);
        }
    }

    const get_lists = async (): Promise<string[] | undefined> => {
        try {
            let list = await get_list("hex");

            setFileList(list!);
            return Promise.resolve(list);
        } catch (error) {
            console.log(error);
            setFileList([]);
            return Promise.reject(error.message);
        }
    }

    const upload_hex = async (file: File): Promise<string> => {
        console.log("upload hex file:", file);
        const formData = new FormData();
        formData.append("fileToUpload", file);

        try {
            const reply = await requestAPI<any>('packrat', {
                body: formData,
                method: 'POST',
            });

            console.log(reply);

            let filename = reply['filename'];
            return Promise.resolve(filename);
        } catch (error) {
            console.log(error);
            console.log(error.message);
            return Promise.reject(error.message);
        }
    }

    const upload_ihex = async (file: File): Promise<string> => {
        console.log("upload ihex file:", file);
        const regex = /PR\d+/g;
        const packrat = file.name.match(regex);
        let fileName = '';
        let packratID = '';

        try {
            if (!packrat)
                return Promise.reject('invalid file name');
            packratID = packrat![0].substr(2)
            fileName = 'PR' + packratID + '.ihex.hex';

            const formData = new FormData();
            formData.append("fileToUpload", file, fileName);

            await requestAPI<any>('packrat/' + packratID, {
                body: formData,
                method: 'POST'
            });
        } catch (error) {
            console.error(`Error - POST /webds/packrat/${packratID}\n${error}`);
            return Promise.reject('Failed to upload blob to Packrat cache');
        }
        return Promise.resolve(fileName);
    }

    const upload_file = async (file: File) => {
        console.log("upload_file:", file);

        if (file) {
            try {
                let filename = '';
                if (file.name.includes("ihex") || file.name.includes("iHex") || file.name.includes("singlechip"))
                    filename = await upload_ihex(file);
                else
                    filename = await upload_hex(file);
                await get_lists();
                setSelect(filename)
            }
            catch (error) {
                console.log(error);
                onMessage('error', error, '')
            }
        }
    }

	const webdsTheme = props.service.ui.getWebDSTheme();

    function ShowContent() {
        return (
            <div>
                <Collapse in={isAlert}>
                    <Alert severity={severityRef.current} onClose={() => setAlert(false)}>
                        <AlertTitle> {resultRef.current} </AlertTitle>
                        {messageRef.current}
                        <Link href={linkRef.current}>{linkRef.current}</Link>
                    </Alert>
                </Collapse>

                <Stack
                    direction="row"
                    justifyContent="center"
                    alignItems="flex-start"
                    sx={{ mr: 8, mb: 4, py: 3}}
                >
                    <Stack spacing={1}
                        direction="column"
                        justifyContent="flex-start"
                        sx={{ mt: 5 }}>
                        <Button variant="text" onClick={handleClick} sx={{ pt: 1 }}>
                            <Avatar sx={{ bgcolor: webdsTheme.palette.primary.light }} variant="rounded">
                                {open ?
                                    <CloseIcon fontSize="large" />
                                    :
                                    <DehazeOutlinedIcon fontSize="large" />
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
                                            <CloudUploadIcon fontSize="large" />
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
                        width: 275
                    }}>
                        <Paper elevation={0} sx={{ bgcolor: 'transparent' }}>
                            <Typography sx={{ m: 1, textAlign: 'center' }}>
                                {open ? "Hex Files" : "Packrat"}
                            </Typography>
                        </Paper>

                        {open ?
                            <Paper variant="outlined" sx={{ m: 0, p: 0, minWidth: 265, /*minHeight: 42*/ }}>
                                <FileList list={filelist} onDelete={onFileDelete} onSelect={onFileSelect} select={select} />
                            </Paper>
                            :
                            start ?
                                <TextFieldWithProgress packrat={packrat} progress={progress} />
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
                    </Stack>
                </Stack>
            </div>
        );
    }

    function ShowControl() {
        return (
            <ButtonProgram title="Program" list={filelist} error={packratError}
                    onStart={onStart} onProgress={onProgress} onMessage={onMessage} service={props.service} />
        );
    }

    const WIDTH = 800;
    const HEIGHT_TITLE = 70;

    function showAll() {
    return (
        <Stack spacing={2}>
            <Paper
                elevation={0}
                sx={{
                    width: WIDTH + "px",
                    height: HEIGHT_TITLE + "px",
                    position: "relative",
                    bgcolor: "section.main"
                }}
            >
                <Typography
                    variant="h5"
                    sx={{
                        position: "absolute",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)"
                    }}
                >
                    Erase & Program
                </Typography>
            </Paper>

            <Stack
                direction="column"
                justifyContent="center"
                alignItems="stretch"

                sx={{
                    width: WIDTH + "px",
                    bgcolor: "section.main",
                }}
            >
                    {ShowContent()}
            </Stack>
            <Stack
                direction="row"
                justifyContent="center"
                alignItems="center"
                sx={{
                    width: WIDTH + "px",
                    minHeight: HEIGHT_CONTROLS + "px",
                    bgcolor: "section.main",
                }}
            >
                    {ShowControl()}
            </Stack>
        </Stack>

    );
}


    return (
        <div className='jp-webds-widget-body'>
            <ThemeProvider theme={webdsTheme}>
                {showAll()}
            </ThemeProvider>
        </div>
    );

}

/**
* A Counter Lumino Widget that wraps a CounterComponent.
*/
export class ShellWidget extends ReactWidget {
	service: WebDSService | null = null;
    id: string;
    /**
    * Constructs a new CounterWidget.
    */
    constructor(id: string, service: WebDSService) {
        super();
        this.id = id;
        this.addClass('jp-webds-widget');
        console.log("TabPanelUiWidget is created!!!");
		this.service = service;
    }

    render(): JSX.Element {
        return (
            <div id={this.id + "_container"} className="jp-webds-widget-container">
                <div id={this.id + "_content"} className="jp-webds-widget">
                    <VerticalTabs service={this.service!} />
                </div>
            </div>
        );
    }
}
