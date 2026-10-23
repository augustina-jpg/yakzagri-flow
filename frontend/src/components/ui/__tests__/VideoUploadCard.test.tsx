import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VideoUploadCard } from '../VideoUploadCard';

// Mock the BentoCard component
jest.mock('../BentoCard', () => ({
    BentoCard: ({ children, title, glowVariant, className }: { children: React.ReactNode, title?: string, icon?: React.ReactNode, glowVariant?: string, className?: string }) => (
        <div data-testid="bento-card" data-title={title} data-glow={glowVariant} className={className}>
            {title && <h3>{title}</h3>}
            {children}
        </div>
    ),
}));

// Mock the Icon component
jest.mock('../Icon', () => ({
    Icon: ({ name, size, className, ...props }: { name: string, size?: string, className?: string, [key: string]: unknown }) => (
        <svg data-testid={`icon-${name}`} data-size={size} className={className} {...props} />
    ),
}));

// Mock XMLHttpRequest
const mockXhr: Record<string, unknown> = {
    upload: {
        onprogress: null as ((ev: ProgressEvent<EventTarget>) => void) | null,
    },
    onload: null as (() => void) | null,
    onerror: null as (() => void) | null,
    open: jest.fn(),
    setRequestHeader: jest.fn(),
    send: jest.fn(),
    status: 200,
    responseText: JSON.stringify({ IpfsHash: 'QmTest123' }),
    statusText: 'OK',
};

global.XMLHttpRequest = jest.fn(() => mockXhr) as unknown as typeof XMLHttpRequest;

// Deterministic SHA-256 digest bytes (32 bytes) used by the mocked crypto.subtle.digest
const MOCK_DIGEST_BYTES = new Uint8Array(32).fill(0xab);
const MOCK_DIGEST_HEX = Array.from(MOCK_DIGEST_BYTES)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

// Mock crypto.subtle.digest
const mockDigest = jest.fn(async () => MOCK_DIGEST_BYTES.buffer);
Object.defineProperty(global, 'crypto', {
    value: { subtle: { digest: mockDigest } },
    configurable: true,
});

// Mock offscreen <video> metadata loading
const mockVideoMetadata = { duration: 30, videoWidth: 1920, videoHeight: 1080 };
let mockVideoShouldError = false;

const originalCreateElement = document.createElement.bind(document);
jest.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
    const element = originalCreateElement(tagName, options);
    if (tagName.toLowerCase() === 'video') {
        const video = element as HTMLVideoElement;
        Object.defineProperty(video, 'duration', {
            configurable: true,
            get: () => mockVideoMetadata.duration,
        });
        Object.defineProperty(video, 'videoWidth', {
            configurable: true,
            get: () => mockVideoMetadata.videoWidth,
        });
        Object.defineProperty(video, 'videoHeight', {
            configurable: true,
            get: () => mockVideoMetadata.videoHeight,
        });
        Object.defineProperty(video, 'src', {
            configurable: true,
            set: () => {
                setTimeout(() => {
                    if (mockVideoShouldError) {
                        video.dispatchEvent(new Event('error'));
                    } else {
                        video.dispatchEvent(new Event('loadedmetadata'));
                    }
                }, 0);
            },
        });
        video.load = jest.fn();
    }
    return element;
}) as typeof document.createElement);

async function triggerXhrHandler(name: "onload" | "onerror") {
    await waitFor(() => expect(mockXhr[name]).toEqual(expect.any(Function)));
    (mockXhr[name] as () => void)();
}

async function triggerUploadProgress() {
    await waitFor(() => {
        expect((mockXhr.upload as { onprogress?: unknown }).onprogress).toEqual(expect.any(Function));
    });
    const onprogress = (mockXhr.upload as { onprogress: (event: { lengthComputable: boolean; loaded: number; total: number }) => void }).onprogress;
    onprogress({ lengthComputable: true, loaded: 50, total: 100 });
}

describe('VideoUploadCard Component', () => {
    const defaultProps = {
        onUpload: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (mockXhr.upload as { onprogress: null }).onprogress = null;
        mockXhr.onload = null;
        mockXhr.onerror = null;
        mockXhr.status = 200;
        mockXhr.responseText = JSON.stringify({ IpfsHash: 'QmTest123' });
        mockDigest.mockClear();
        mockVideoMetadata.duration = 30;
        mockVideoMetadata.videoWidth = 1920;
        mockVideoMetadata.videoHeight = 1080;
        mockVideoShouldError = false;
    });

    it('renders without crashing with all props', () => {
        const { container } = render(<VideoUploadCard {...defaultProps} />);
        expect(container.firstChild).toBeInTheDocument();
    });

    it('displays the evidence upload title', () => {
        render(<VideoUploadCard {...defaultProps} />);
        expect(screen.getByText('Evidence Upload')).toBeInTheDocument();
    });

    it('displays upload instruction text', () => {
        render(<VideoUploadCard {...defaultProps} />);
        expect(screen.getByText('Upload delivery proof video for verification')).toBeInTheDocument();
    });

    it('displays drag and drop instruction', () => {
        render(<VideoUploadCard {...defaultProps} />);
        expect(screen.getByText('Drag & drop or click to browse')).toBeInTheDocument();
    });

    it('renders the video icon', () => {
        const { container } = render(<VideoUploadCard {...defaultProps} />);
        const videoIcon = container.querySelector('svg');
        expect(videoIcon).toBeInTheDocument();
    });

    it('renders the file input', () => {
        const { container } = render(<VideoUploadCard {...defaultProps} />);
        const fileInput = container.querySelector('input[type="file"]');
        expect(fileInput).toBeInTheDocument();
    });

    it('accepts video file types', () => {
        const { container } = render(<VideoUploadCard {...defaultProps} />);
        const fileInput = container.querySelector('input[type="file"]');
        expect(fileInput).toHaveAttribute('accept', 'video/mp4,video/webm');
    });

    it('displays submit proof button', () => {
        render(<VideoUploadCard {...defaultProps} />);
        expect(screen.getByText('Submit Proof')).toBeInTheDocument();
    });

    it('disables submit button when no file is uploaded', () => {
        render(<VideoUploadCard {...defaultProps} />);
        const submitButton = screen.getByText('Submit Proof');
        expect(submitButton).toBeDisabled();
    });

    it('enables submit button after successful upload', async () => {
        render(<VideoUploadCard {...defaultProps} />);

        const file = new File(['test'], 'test.mp4', { type: 'video/mp4' });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

        Object.defineProperty(fileInput, 'files', {
            value: [file],
        });

        fireEvent.change(fileInput);

        // Simulate successful upload
        await triggerXhrHandler('onload');

        await waitFor(() => {
            const submitButton = screen.getByText('Submit Proof');
            expect(submitButton).not.toBeDisabled();
        });
    });

    it('displays upload progress when uploading', async () => {
        render(<VideoUploadCard {...defaultProps} />);

        const file = new File(['test'], 'test.mp4', { type: 'video/mp4' });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

        Object.defineProperty(fileInput, 'files', {
            value: [file],
        });

        fireEvent.change(fileInput);

        // Simulate progress
        await triggerUploadProgress();

        await waitFor(() => {
            expect(screen.getByText('Uploading to IPFS…')).toBeInTheDocument();
            expect(screen.getByText('50%')).toBeInTheDocument();
        });
    });

    it('displays IPFS hash after successful upload', async () => {
        render(<VideoUploadCard {...defaultProps} />);

        const file = new File(['test'], 'test.mp4', { type: 'video/mp4' });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

        Object.defineProperty(fileInput, 'files', {
            value: [file],
        });

        fireEvent.change(fileInput);

        // Simulate successful upload
        await triggerXhrHandler('onload');

        await waitFor(() => {
            expect(screen.getByText('QmTest123')).toBeInTheDocument();
        });
    });

    it('calls onUpload callback after successful upload', async () => {
        const onUpload = jest.fn();
        render(<VideoUploadCard onUpload={onUpload} />);

        const file = new File(['test'], 'test.mp4', { type: 'video/mp4' });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

        Object.defineProperty(fileInput, 'files', {
            value: [file],
        });

        fireEvent.change(fileInput);

        // Simulate successful upload
        await triggerXhrHandler('onload');

        await waitFor(() => {
            expect(onUpload).toHaveBeenCalledWith('QmTest123');
        });
    });

    it('submits the ready proof when the Submit Proof button is clicked', async () => {
        const onUpload = jest.fn();
        render(<VideoUploadCard onUpload={onUpload} />);

        const file = new File(['test'], 'test.mp4', { type: 'video/mp4' });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

        Object.defineProperty(fileInput, 'files', {
            value: [file],
        });

        fireEvent.change(fileInput);

        await triggerXhrHandler('onload');

        await waitFor(() => {
            const submitButton = screen.getByRole('button', { name: /submit proof/i });
            expect(submitButton).not.toBeDisabled();
            fireEvent.click(submitButton);
            expect(onUpload).toHaveBeenLastCalledWith('QmTest123');
        });
    });

    it('displays error message on upload failure', async () => {
        mockXhr.status = 500;
        mockXhr.statusText = 'Internal Server Error';

        render(<VideoUploadCard {...defaultProps} />);

        const file = new File(['test'], 'test.mp4', { type: 'video/mp4' });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

        Object.defineProperty(fileInput, 'files', {
            value: [file],
        });

        fireEvent.change(fileInput);

        // Simulate failed upload
        await triggerXhrHandler('onload');

        await waitFor(() => {
            expect(screen.getByText(/Upload failed/)).toBeInTheDocument();
        });
    });

    it('displays error message on network error', async () => {
        render(<VideoUploadCard {...defaultProps} />);

        const file = new File(['test'], 'test.mp4', { type: 'video/mp4' });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

        Object.defineProperty(fileInput, 'files', {
            value: [file],
        });

        fireEvent.change(fileInput);

        // Simulate network error
        await triggerXhrHandler('onerror');

        await waitFor(() => {
            expect(screen.getByText('Network error during upload')).toBeInTheDocument();
        });
    });

    it('handles file drop', async () => {
        render(<VideoUploadCard {...defaultProps} />);

        const dropZone = screen.getByText('Upload delivery proof video for verification').closest('div');
        const file = new File(['test'], 'test.mp4', { type: 'video/mp4' });

        const dropEvent = new Event('drop', { bubbles: true });
        Object.defineProperty(dropEvent, 'dataTransfer', {
            value: {
                files: [file],
            },
        });

        fireEvent(dropZone!, dropEvent);

        // Verify upload started
        await waitFor(() => {
            expect(mockXhr.open).toHaveBeenCalled();
        });
    });

    it('handles file input change', async () => {
        render(<VideoUploadCard {...defaultProps} />);

        const file = new File(['test'], 'test.mp4', { type: 'video/mp4' });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

        Object.defineProperty(fileInput, 'files', {
            value: [file],
        });

        fireEvent.change(fileInput);

        // Verify upload started
        await waitFor(() => {
            expect(mockXhr.open).toHaveBeenCalled();
        });
    });

    it('renders IPFS link after successful upload', async () => {
        render(<VideoUploadCard {...defaultProps} />);

        const file = new File(['test'], 'test.mp4', { type: 'video/mp4' });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

        Object.defineProperty(fileInput, 'files', {
            value: [file],
        });

        fireEvent.change(fileInput);

        // Simulate successful upload
        await triggerXhrHandler('onload');

        await waitFor(() => {
            const link = screen.getByLabelText('View on IPFS');
            expect(link).toHaveAttribute('href', 'https://gateway.pinata.cloud/ipfs/QmTest123');
        });
    });

    it('applies gold glow variant', () => {
        const { container } = render(<VideoUploadCard {...defaultProps} />);
        const card = container.querySelector('[data-testid="bento-card"]');
        expect(card).toHaveAttribute('data-glow', 'gold');
    });

    it('applies correct styling classes to the card', () => {
        const { container } = render(<VideoUploadCard {...defaultProps} />);
        const card = container.querySelector('[data-testid="bento-card"]');
        expect(card).toHaveClass('h-full');
    });

    it('computes and displays the SHA-256 checksum of the selected video', async () => {
        render(<VideoUploadCard {...defaultProps} />);

        const file = new File(['test'], 'test.mp4', { type: 'video/mp4' });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

        Object.defineProperty(fileInput, 'files', {
            value: [file],
        });

        fireEvent.change(fileInput);

        await waitFor(() => {
            expect(mockDigest).toHaveBeenCalledWith('SHA-256', expect.anything());
            expect(screen.getByText(MOCK_DIGEST_HEX)).toBeInTheDocument();
        });
    });

    it('copies the SHA-256 checksum to the clipboard', async () => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText },
            configurable: true,
        });

        render(<VideoUploadCard {...defaultProps} />);

        const file = new File(['test'], 'test.mp4', { type: 'video/mp4' });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

        Object.defineProperty(fileInput, 'files', {
            value: [file],
        });

        fireEvent.change(fileInput);

        await waitFor(() => {
            expect(screen.getByText(MOCK_DIGEST_HEX)).toBeInTheDocument();
        });

        fireEvent.click(screen.getByLabelText('Copy SHA-256 checksum'));

        await waitFor(() => {
            expect(writeText).toHaveBeenCalledWith(MOCK_DIGEST_HEX);
        });
    });

    it('includes the SHA-256 digest in the upload request metadata', async () => {
        render(<VideoUploadCard {...defaultProps} />);

        const file = new File(['test'], 'test.mp4', { type: 'video/mp4' });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

        Object.defineProperty(fileInput, 'files', {
            value: [file],
        });

        fireEvent.change(fileInput);

        await waitFor(() => {
            expect(mockXhr.send).toHaveBeenCalled();
        });

        const formData = (mockXhr.send as jest.Mock).mock.calls[0][0] as FormData;
        expect(formData).toBeInstanceOf(FormData);
        expect(formData.get('sha256')).toBe(MOCK_DIGEST_HEX);
    });

    it('rejects unsupported MIME types without starting an upload', async () => {
        render(<VideoUploadCard {...defaultProps} />);

        const file = new File(['test'], 'test.txt', { type: 'text/plain' });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

        Object.defineProperty(fileInput, 'files', {
            value: [file],
        });

        fireEvent.change(fileInput);

        await waitFor(() => {
            expect(screen.getByText(/unsupported/i)).toBeInTheDocument();
        });
        expect(mockXhr.open).not.toHaveBeenCalled();
        expect(mockXhr.send).not.toHaveBeenCalled();
    });

    it('rejects zero-byte files without starting an upload', async () => {
        render(<VideoUploadCard {...defaultProps} />);

        const file = new File([], 'empty.mp4', { type: 'video/mp4' });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

        Object.defineProperty(fileInput, 'files', {
            value: [file],
        });

        fireEvent.change(fileInput);

        await waitFor(() => {
            expect(screen.getByText(/empty/i)).toBeInTheDocument();
        });
        expect(mockXhr.open).not.toHaveBeenCalled();
        expect(mockXhr.send).not.toHaveBeenCalled();
    });

    it('rejects files larger than 50 MB without starting an upload', async () => {
        render(<VideoUploadCard {...defaultProps} />);

        const file = new File(['test'], 'large.mp4', { type: 'video/mp4' });
        Object.defineProperty(file, 'size', { value: 51 * 1024 * 1024 });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

        Object.defineProperty(fileInput, 'files', {
            value: [file],
        });

        fireEvent.change(fileInput);

        await waitFor(() => {
            expect(screen.getByText(/50 MB/i)).toBeInTheDocument();
        });
        expect(mockXhr.open).not.toHaveBeenCalled();
        expect(mockXhr.send).not.toHaveBeenCalled();
    });

    it('displays duration and resolution preview after metadata loads', async () => {
        render(<VideoUploadCard {...defaultProps} />);

        const file = new File(['test'], 'test.mp4', { type: 'video/mp4' });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

        Object.defineProperty(fileInput, 'files', {
            value: [file],
        });

        fireEvent.change(fileInput);

        await waitFor(() => {
            expect(screen.getByText(/0:30/)).toBeInTheDocument();
            expect(screen.getByText(/1920\s*[x×]\s*1080/)).toBeInTheDocument();
        });
    });

    it('rejects videos shorter than the minimum duration', async () => {
        mockVideoMetadata.duration = 2;
        render(<VideoUploadCard {...defaultProps} />);

        const file = new File(['test'], 'test.mp4', { type: 'video/mp4' });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

        Object.defineProperty(fileInput, 'files', {
            value: [file],
        });

        fireEvent.change(fileInput);

        await waitFor(() => {
            expect(screen.getByText(/duration/i)).toBeInTheDocument();
        });
        expect(mockXhr.open).not.toHaveBeenCalled();
        expect(mockXhr.send).not.toHaveBeenCalled();
    });

    it('rejects videos longer than the maximum duration', async () => {
        mockVideoMetadata.duration = 200;
        render(<VideoUploadCard {...defaultProps} />);

        const file = new File(['test'], 'test.mp4', { type: 'video/mp4' });
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

        Object.defineProperty(fileInput, 'files', {
            value: [file],
        });

        fireEvent.change(fileInput);

        await waitFor(() => {
            expect(screen.getByText(/duration/i)).toBeInTheDocument();
        });
        expect(mockXhr.open).not.toHaveBeenCalled();
        expect(mockXhr.send).not.toHaveBeenCalled();
    });
});
