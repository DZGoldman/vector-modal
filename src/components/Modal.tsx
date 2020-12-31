import { BrowserNode } from '@connext/vector-browser-node';
import React, { FC, useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  Grid,
  Divider,
  Button,
  Typography,
  Skeleton,
  TextField,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  InputAdornment,
  IconButton,
  Card,
  Chip,
  ThemeProvider,
  MenuItem,
  Popper,
  MenuList,
  ClickAwayListener,
  Paper,
  Grow,
  CircularProgress,
  Tooltip,
  withStyles,
  StepIconProps,
  Icon,
} from '@material-ui/core';
import {
  MoreVert,
  FileCopy,
  Check,
  Close,
  DoubleArrow,
  CropFree,
  Brightness4,
  WbSunny,
  CheckCircleRounded,
  FiberManualRecordOutlined,
  ErrorRounded,
} from '@material-ui/icons';
import {
  makeStyles,
  createStyles,
  Theme,
  createMuiTheme,
} from '@material-ui/core/styles';
import { purple, green } from '@material-ui/core/colors';
// @ts-ignore
import QRCode from 'qrcode.react';
import { BigNumber, constants, utils } from 'ethers';
import { EngineEvents } from '@connext/vector-types';
import { getRandomBytes32 } from '@connext/vector-utils';
import {
  CHAIN_INFO_URL,
  getAssetName,
  TransferStates,
  TRANSFER_STATES,
} from '../constants';
import { connext } from '../service';
import {
  getExplorerLinkForTx,
  activePhase,
  getAssetBalance,
  hydrateProviders,
  getExplorerLinkForAsset,
} from '../utils';
import Loading from './Loading';

const theme = createMuiTheme({
  palette: {
    mode: 'light',
    primary: {
      main: purple[500],
    },
    secondary: {
      main: green[700],
    },
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ].join(','),
  },
  spacing: 2,
});

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    root: {
      width: '100%',
    },
    spacing: {
      margin: theme.spacing(3, 2),
    },
    card: {
      height: 'auto',
      minWidth: '390px',
    },
    header: {},
    networkBar: { paddingBottom: '1rem' },
    status: { paddingBottom: '1rem' },
    ethereumAddress: { paddingBottom: '1rem' },
    completeState: { paddingBottom: '1rem' },
    errorState: { paddingBottom: '1rem' },
  })
);

export type ConnextModalProps = {
  showModal: boolean;
  routerPublicIdentifier: string;
  depositChainId: number;
  depositAssetId: string;
  withdrawChainId: number;
  withdrawAssetId: string;
  withdrawalAddress: string;
  onClose: () => void;
  connextNode?: BrowserNode;
};

const ConnextModal: FC<ConnextModalProps> = ({
  showModal,
  routerPublicIdentifier,
  depositChainId,
  depositAssetId,
  withdrawChainId,
  withdrawAssetId,
  withdrawalAddress,
  onClose,
  connextNode,
}) => {
  const classes = useStyles();
  const [depositAddress, setDepositAddress] = useState<string>();
  const [depositChainName, setDepositChainName] = useState<string>(
    depositChainId.toString()
  );
  const [withdrawChainName, setWithdrawChainName] = useState<string>(
    withdrawChainId.toString()
  );
  const [sentAmount, setSentAmount] = useState<string>('0');

  const [withdrawTx, setWithdrawTx] = useState<string>();
  const [crossChainTransfers, setCrossChainTransfers] = useState<{
    [crossChainTransferId: string]: TransferStates;
  }>({});
  const [initing, setIniting] = useState<boolean>(true);

  const [activeStep, setActiveStep] = React.useState(-1);

  const [activeCrossChainTransferId, setActiveCrossChainTransferId] = useState<
    string
  >(constants.HashZero);

  const [error, setError] = useState<Error>();

  const transferState: TransferStates =
    crossChainTransfers[activeCrossChainTransferId] ?? TRANSFER_STATES.INITIAL;

  const registerEngineEventListeners = (node: BrowserNode): void => {
    node.on(EngineEvents.DEPOSIT_RECONCILED, data => {
      console.log(data);
      // if (data.meta.crossChainTransferId) {
      setCrossChainTransferWithErrorTimeout(
        activeCrossChainTransferId,
        TRANSFER_STATES.TRANSFERRING
      );
      // }
    });
    node.on(EngineEvents.CONDITIONAL_TRANSFER_RESOLVED, data => {
      if (
        data.transfer.meta.crossChainTransferId &&
        data.transfer.initiator === node.signerAddress
      ) {
        setCrossChainTransferWithErrorTimeout(
          data.transfer.meta.crossChainTransferId,
          TRANSFER_STATES.WITHDRAWING
        );
      }
    });
    node.on(EngineEvents.WITHDRAWAL_RESOLVED, data => {
      if (
        data.transfer.meta.crossChainTransferId &&
        data.transfer.initiator === node.signerAddress
      ) {
        setCrossChainTransferWithErrorTimeout(
          data.transfer.meta.crossChainTransferId,
          TRANSFER_STATES.COMPLETE
        );
      }
    });
  };

  const setCrossChainTransferWithErrorTimeout = (
    crossChainTransferId: string,
    phase: TransferStates
  ) => {
    let tracked = { ...crossChainTransfers };
    tracked[crossChainTransferId] = phase;
    setCrossChainTransfers(tracked);
    setActiveStep(activePhase(phase));
    setTimeout(() => {
      if (crossChainTransfers[crossChainTransferId] !== phase) {
        return;
      }
      // Error if not updated
      let tracked = { ...crossChainTransfers };
      tracked[crossChainTransferId] = TRANSFER_STATES.ERROR;
      setCrossChainTransfers(tracked);
      setActiveStep(activePhase(phase));
      setError(new Error(`No updates within 30s for ${crossChainTransferId}`));
    }, 30_000);
  };

  const getChainInfo = async () => {
    try {
      const chainInfo: any[] = await utils.fetchJson(CHAIN_INFO_URL);
      const depositChainInfo = chainInfo.find(
        info => info.chainId === depositChainId
      );
      if (depositChainInfo) {
        setDepositChainName(depositChainInfo.name);
      }

      const withdrawChainInfo = chainInfo.find(
        info => info.chainId === withdrawChainId
      );
      if (withdrawChainInfo) {
        setWithdrawChainName(withdrawChainInfo.name);
      }
    } catch (e) {
      console.warn(`Could not fetch chain info from ${CHAIN_INFO_URL}`);
    }
  };

  const blockListenerAndTransfer = async (_depositAddress: string) => {
    const _ethProviders = hydrateProviders(depositChainId, withdrawChainId);
    _ethProviders[depositChainId].on('block', async blockNumber => {
      console.log('New blockNumber: ', blockNumber);

      let transferAmount: BigNumber;
      try {
        transferAmount = await getAssetBalance(
          _ethProviders,
          depositChainId,
          depositAssetId,
          _depositAddress
        );
      } catch (e) {
        setIniting(false);
        setError(e);
        return;
      }
      console.log(
        `Balance on ${depositChainId} for ${_depositAddress} of asset ${depositAssetId}: ${transferAmount.toString()}`
      );

      if (transferAmount.gt(0)) {
        const crossChainTransferId = getRandomBytes32();
        setActiveCrossChainTransferId(crossChainTransferId);
        const updated = { ...crossChainTransfers };
        updated[crossChainTransferId] = TRANSFER_STATES.DEPOSITING;
        setCrossChainTransfers(updated);
        setActiveStep(activePhase(TRANSFER_STATES.DEPOSITING));
        _ethProviders[depositChainId].off('block');

        await connext
          .connextClient!.crossChainTransfer({
            amount: transferAmount.toString(),
            fromAssetId: depositAssetId,
            fromChainId: depositChainId,
            toAssetId: withdrawAssetId,
            toChainId: withdrawChainId,
            reconcileDeposit: true,
            withdrawalAddress,
            meta: { crossChainTransferId },
          })
          .then(result => {
            console.log('crossChainTransfer: ', result);
            setWithdrawTx(result.withdrawalTx);
            setSentAmount(result.withdrawalAmount ?? '0');
            setActiveStep(activePhase(TRANSFER_STATES.COMPLETE));
            updated[crossChainTransferId] = TRANSFER_STATES.COMPLETE;
            setCrossChainTransfers(updated);
          })
          .catch(e => {
            setError(e);
            console.error('Error in crossChainTransfer: ', e);
            const updated = { ...crossChainTransfers };
            updated[crossChainTransferId] = TRANSFER_STATES.ERROR;
            setActiveStep(activePhase(TRANSFER_STATES.ERROR));
            setCrossChainTransfers(updated);
          });
      }
    });
  };

  useEffect(() => {
    const init = async () => {
      if (showModal) {
        await getChainInfo();

        // browser node object
        let channelPublicIdentifier: string;
        try {
          channelPublicIdentifier = await connext.connectNode(
            connextNode,
            routerPublicIdentifier,
            depositChainId,
            withdrawChainId
          );
          setDepositAddress(channelPublicIdentifier);
        } catch (e) {
          console.error('Error initalizing Browser Node: ', e);
          if (e.message.includes('localStorage not available in this window')) {
            alert(
              'Please disable shields or ad blockers and try again. Connext requires cross-site cookies to store your channel states.'
            );
          }
          setCrossChainTransfers({
            ...crossChainTransfers,
            [constants.HashZero]: TRANSFER_STATES.ERROR,
          });
          setActiveStep(activePhase(TRANSFER_STATES.ERROR));
          setIniting(false);
          setError(e);
          return;
        }

        registerEngineEventListeners(connext.connextClient!);
        console.log('INITIALIZED BROWSER NODE');

        const _depositAddress: string = channelPublicIdentifier;

        await blockListenerAndTransfer(_depositAddress);

        setIniting(false);
      }
    };
    init();
  }, [showModal]);

  return (
    <ThemeProvider theme={theme}>
      <Dialog open={showModal} fullWidth={true} maxWidth="xs">
        <Card className={classes.card}>
          <Grid
            id="Header"
            container
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            className={classes.header}
          >
            <Grid item>
              <IconButton
                aria-label="close"
                disabled={[
                  TRANSFER_STATES.DEPOSITING,
                  TRANSFER_STATES.TRANSFERRING,
                  TRANSFER_STATES.WITHDRAWING,
                ].includes(transferState as any)}
                onClick={onClose}
              >
                <Close />
              </IconButton>
            </Grid>
            <Grid item>
              <Typography gutterBottom variant="h6">
                Send{' '}
                <a
                  href={getExplorerLinkForAsset(depositChainId, depositAssetId)}
                  target="_blank"
                >
                  {getAssetName(depositAssetId, depositChainId)}
                </a>
              </Typography>
            </Grid>
            {/* <Grid item>
              <ThemeButton />
            </Grid> */}
            <Grid item>
              <Options />
            </Grid>
          </Grid>

          <div style={{ padding: '1rem' }}>
            {initing && <Loading message={'Setting up channels...'} />}
            {depositAddress ? (
              <>
                <NetworkBar
                  depositChainName={depositChainName}
                  withdrawChainName={withdrawChainName}
                  styles={classes.networkBar}
                />
                <EthereumAddress
                  depositAddress={depositAddress}
                  styles={classes.ethereumAddress}
                />
                <Status
                  depositChainName={depositChainName}
                  withdrawChainName={withdrawChainName}
                  activeStep={activeStep}
                  styles={classes.status}
                />
                <Grid container>
                  <Grid item xs={12}>
                    <TextField
                      id="receiver-address"
                      defaultValue={withdrawalAddress}
                      label="Receiver Address"
                      type="search"
                      fullWidth
                    />
                  </Grid>
                </Grid>
              </>
            ) : (
              <>
                <Skeleton variant="rectangular" height={300} />
              </>
            )}
            {!initing && transferState === TRANSFER_STATES.COMPLETE && (
              <CompleteState
                withdrawChainName={withdrawChainName}
                withdrawTx={withdrawTx!}
                sentAmount={sentAmount!}
                withdrawChainId={withdrawChainId}
                withdrawAssetId={withdrawAssetId}
                styles={classes.completeState}
              />
            )}
            {!initing && transferState === TRANSFER_STATES.ERROR && (
              <ErrorState
                error={error ?? new Error('unknown')}
                crossChainTransferId={activeCrossChainTransferId}
                styles={classes.errorState}
              />
            )}
          </div>

          <Grid id="Footer" container direction="row" justifyContent="center">
            <Typography variant="overline">
              <a href="https://connext.network" target="_blank">
                Powered By Connext
              </a>
            </Typography>
          </Grid>
        </Card>
      </Dialog>
    </ThemeProvider>
  );
};

export interface StatusProps {
  depositChainName: string;
  withdrawChainName: string;
  activeStep: number;
  styles: string;
}

const Status: FC<StatusProps> = props => {
  const { depositChainName, withdrawChainName, activeStep, styles } = props;
  const steps = ['Deposit', 'Transfer', 'Withdraw'];

  function getStepContent(step: number) {
    switch (step) {
      case 0:
        return `Detected deposit on-chain(${depositChainName}), depositing into state channel!`;
      case 1:
        return `Transferring from ${depositChainName} to ${withdrawChainName}`;
      case 2:
        return `Withdrawing funds back on-chain(${withdrawChainName}!`;
      default:
        return 'Unknown step';
    }
  }

  function StepIcon(props: StepIconProps) {
    const { active, completed } = props;

    const icon: React.ReactElement = active ? (
      <CircularProgress size="1rem" color="primary" />
    ) : completed ? (
      <Icon fontSize="small" color="primary">
        <CheckCircleRounded />
      </Icon>
    ) : (
      <Icon fontSize="small" color="primary">
        <FiberManualRecordOutlined />
      </Icon>
    );

    const icons: { [index: string]: React.ReactElement } = {
      1: icon,
      2: icon,
      3: icon,
    };

    return <>{icons[String(props.icon)]}</>;
  }

  return (
    <Grid container className={styles}>
      <Grid item xs={12}>
        <Stepper activeStep={activeStep} orientation="vertical">
          {steps.map((label, index) => (
            <Step key={label}>
              <StepLabel StepIconComponent={StepIcon}>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Grid>
    </Grid>
  );
};

const Options: FC = () => {
  const [open, setOpen] = React.useState(false);
  const anchorRef = React.useRef<HTMLButtonElement>(null);

  const handleToggle = () => {
    setOpen(prevOpen => !prevOpen);
  };

  const handleClose = (event: React.MouseEvent<EventTarget>) => {
    if (
      anchorRef.current &&
      anchorRef.current.contains(event.target as HTMLElement)
    ) {
      return;
    }

    setOpen(false);
  };

  function handleListKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Tab') {
      event.preventDefault();
      setOpen(false);
    }
  }

  // return focus to the button when we transitioned from !open -> open
  const prevOpen = React.useRef(open);
  React.useEffect(() => {
    if (prevOpen.current === true && open === false) {
      anchorRef.current!.focus();
    }

    prevOpen.current = open;
  }, [open]);
  return (
    <>
      <IconButton
        aria-label="options"
        ref={anchorRef}
        aria-controls={open ? 'menu-list-grow' : undefined}
        aria-haspopup="true"
        onClick={handleToggle}
      >
        <MoreVert />
      </IconButton>
      <Popper
        open={open}
        anchorEl={anchorRef.current}
        role={undefined}
        transition
        disablePortal
      >
        {({ TransitionProps, placement }) => (
          <Grow
            {...TransitionProps}
            style={{
              transformOrigin:
                placement === 'bottom' ? 'center top' : 'center bottom',
            }}
          >
            <Paper>
              <ClickAwayListener onClickAway={handleClose}>
                <MenuList
                  autoFocusItem={open}
                  id="menu-list-grow"
                  onKeyDown={handleListKeyDown}
                >
                  <MenuItem
                    id="link"
                    onClick={() =>
                      window.open(
                        'https://discord.com/channels/454734546869551114',
                        '_blank'
                      )
                    }
                  >
                    {/* <Chat /> */}
                    Discord
                  </MenuItem>
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>
    </>
  );
};

// @ts-ignore
const ThemeButton: FC = () => {
  const [isDark, setIsDark] = useState(false);

  theme.palette.mode = isDark ? 'dark' : 'light';

  const StyledTooltip = withStyles({
    tooltip: {
      marginTop: '0.2rem',
      backgroundColor: 'rgba(0,0,0,0.72)',
      color: '#fff',
    },
  })(Tooltip);

  return (
    <StyledTooltip
      title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
    >
      <IconButton onClick={() => setIsDark(!isDark)}>
        {isDark ? <WbSunny /> : <Brightness4 />}
      </IconButton>
    </StyledTooltip>
  );
};

export interface EthereumAddressProps {
  depositAddress: string;
  styles: string;
}

const EthereumAddress: FC<EthereumAddressProps> = props => {
  const { depositAddress, styles } = props;
  const [copiedDepositAddress, setCopiedDepositAddress] = useState<boolean>(
    false
  );

  const [open, setOpen] = React.useState(false);

  const handleOpen = () => {
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };
  return (
    <>
      <Grid container alignItems="flex-end" className={styles}>
        <Grid item xs={12}>
          <TextField
            label="Deposit Address"
            defaultValue={depositAddress}
            InputProps={{
              readOnly: true,
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => {
                      console.log(`Copying: ${depositAddress}`);
                      navigator.clipboard.writeText(depositAddress);
                      setCopiedDepositAddress(true);
                      setTimeout(() => setCopiedDepositAddress(false), 5000);
                    }}
                    edge="end"
                  >
                    {!copiedDepositAddress ? <FileCopy /> : <Check />}
                  </IconButton>
                  <IconButton onClick={handleOpen} edge="end">
                    <CropFree />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            fullWidth
          />
        </Grid>
        <Dialog
          onClose={handleClose}
          aria-labelledby="simple-dialog-title"
          open={open}
        >
          <DialogTitle id="simple-dialog-title">
            Scan this code using your mobile wallet app
          </DialogTitle>
          <Grid
            id="qrcode"
            container
            direction="row"
            justifyContent="center"
            alignItems="flex-start"
            className={styles}
          >
            <QRCode value={depositAddress} />
          </Grid>
        </Dialog>
      </Grid>
    </>
  );
};
export interface NetworkBarProps {
  depositChainName: string;
  withdrawChainName: string;
  styles: string;
}

const NetworkBar: FC<NetworkBarProps> = props => {
  const { depositChainName, withdrawChainName, styles } = props;

  return (
    <>
      <Grid
        id="network"
        container
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        className={styles}
      >
        <Grid item>
          <Chip color="secondary" label={depositChainName} />
        </Grid>
        <Grid item>
          <IconButton aria-label="arrow">
            <DoubleArrow />
          </IconButton>
        </Grid>
        <Grid item>
          <Chip color="primary" label={withdrawChainName} />
        </Grid>
      </Grid>
    </>
  );
};

export interface CompleteStateProps {
  withdrawTx: string;
  withdrawChainName: string;
  withdrawAssetId: string;
  withdrawChainId: number;
  sentAmount: string;
  styles: string;
}

const CompleteState: FC<CompleteStateProps> = ({
  withdrawTx,
  withdrawChainName,
  sentAmount,
  withdrawAssetId,
  withdrawChainId,
  styles,
}) => (
  <>
    <Divider variant="middle" className={styles} />
    <Grid container alignItems="center" direction="column">
      <Icon color="secondary" fontSize="large">
        <CheckCircleRounded />
      </Icon>
      <Typography gutterBottom variant="h6">
        Success
      </Typography>
    </Grid>

    <Typography gutterBottom variant="body1" align="center">
      {utils.formatEther(sentAmount)}{' '}
      <a
        href={getExplorerLinkForAsset(withdrawChainId, withdrawAssetId)}
        target="_blank"
      >
        {getAssetName(withdrawAssetId, withdrawChainId)}
      </a>{' '}
      has been successfully transfered to {withdrawChainName}
    </Typography>

    <Grid container direction="row" justifyContent="center">
      <Button
        variant="contained"
        href={getExplorerLinkForTx(withdrawChainId, withdrawTx)}
        target="_blank"
      >
        Withdrawal Transaction
      </Button>
    </Grid>
  </>
);

export interface ErrorStateProps {
  error: Error;
  crossChainTransferId: string;
  styles: string;
}

const ErrorState: FC<ErrorStateProps> = ({
  error,
  crossChainTransferId,
  styles,
}) => (
  <>
    <Divider variant="middle" className={styles} />
    <Grid container alignItems="center" direction="column">
      <Icon color="error" fontSize="large">
        <ErrorRounded />
      </Icon>
      <Typography gutterBottom variant="h6">
        Error
      </Typography>
    </Grid>

    <Typography gutterBottom variant="body1" align="center">
      {`${crossChainTransferId.substring(0, 5)}... - ${error.message}`}
    </Typography>
  </>
);

export default ConnextModal;