"use client";

import React, { Dispatch, SyntheticEvent, useState } from "react";
import { VscLoading, VscSearch, VscSettings } from "react-icons/vsc";
import ms from "ms";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import AuthDropdown, { useAuthMenu, supabase } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:3031";

enum StorageKeys {
  Limit = "@app/crawl_limit",
  ReturnFormat = "@app/return_format",
  Request = "@app/request",
}

const localStorageReady = typeof localStorage !== "undefined";

const loadDefaultCrawlLimit = () => {
  if (!localStorageReady) {
    return 50;
  }
  const climit = localStorage.getItem(StorageKeys.Limit);
  return climit ? parseInt(climit, 10) : 50;
};
const loadDefaultReturnType = () => {
  if (!localStorageReady) {
    return "raw";
  }
  const returnFormat = localStorage.getItem(StorageKeys.ReturnFormat);
  return returnFormat || "raw";
};
const loadDefaultRequest = () => {
  if (!localStorageReady) {
    return "http";
  }
  const request = localStorage.getItem(StorageKeys.Request);
  return request || "http";
};

const SearchBar = ({ setDataValues }: { setDataValues: Dispatch<any> }) => {
  const [url, setURl] = useState<string>("");
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  const [configModalOpen, setConfigModalOpen] = useState<boolean>(false);
  const [crawlLimit, setCrawlLimit] = useState<number>(loadDefaultCrawlLimit());
  const [returnFormat, setReturnFormat] = useState<string>(
    loadDefaultReturnType(),
  );
  const [request, setRequest] = useState<string>(loadDefaultRequest());

  const auth = useAuthMenu();

  const { toast } = useToast();

  const onAPIEvent = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    const jwt = auth.$session?.access_token;

    if (!jwt) {
      return toast({
        title: "Authentication Required",
        description:
          "Please login or register with spider.cloud and purchase credits.",
      });
    }

    if (!url) {
      return toast({
        title: "URL Required",
        description: "Please enter a valid website url.",
      });
    }

    const paramValues = {
      url: url.startsWith("http") ? url : `https://${url}`,
      limit: crawlLimit,
      return_format: returnFormat,
      request,
    };

    setDataLoading(true);

    const current = performance.now();

    let pages = 0;
    let finished = false;

    try {
      const res = await fetch(API_URL + "/crawl", {
        method: "POST",
        body: JSON.stringify(paramValues),
        headers: {
          "content-type": "application/jsonl",
          authorization: jwt,
        },
      });

      if (res.ok) {
        finished = true;

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        let content = "";
        let validContent = "";

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            pages += 1;
            content += decoder.decode(value, { stream: true });

            if (processChunk(content)) {
              content = ""; // Reset content after processing chunk
              if (validContent !== "done") {
                validContent = "set";
              }
            }

            if (validContent == "set") {
              validContent = "done";
            }
          }

          if (content.length > 0) {
            processChunk(content);
          }
        }
      }
    } catch (e) {
      if (e instanceof Error) {
        console.error(e);
      }
    } finally {
      setDataLoading(false);
      if (finished) {
        toast({
          title: "Crawl finished",
          description: `The time took was ${ms(performance.now() - current, {
            long: true,
          })} for ${pages} page${pages === 1 ? "" : "s"}.`,
        });
      }
    }
  };

  const processChunk = (chunk: string) => {
    let processedData: any[];

    try {
      processedData = chunk
        .split("\n")
        .filter((line) => line?.trim())
        .map((line) => JSON.parse(line));

      requestAnimationFrame(() => {
        setDataValues((prevData: any) => {
          if (prevData && Array.isArray(prevData)) {
            return [...prevData, ...processedData];
          }
          return processedData;
        });
      });

      return true;
    } catch (_error) {
      return false;
    }
  };

  const onChangeEvent = (e: SyntheticEvent<HTMLInputElement>) =>
    setURl(e.currentTarget.value);

  const openConfigModal = () => setConfigModalOpen(true);
  const closeConfigModal = () => setConfigModalOpen(false);

  const handleLimitChange = (e: SyntheticEvent<HTMLInputElement>) =>
    setCrawlLimit(Number(e.currentTarget.value));
  const handleFormatChange = (v: string) => setReturnFormat(v);
  const handleReturnChange = (v: string) => setRequest(v);

  const onLogoutEvent = async (e: SyntheticEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    await supabase.auth.signOut();
    closeConfigModal();
  };

  const saveConfigEvent = () => {
    localStorage.setItem(StorageKeys.Limit, crawlLimit + "");
    localStorage.setItem(StorageKeys.Request, request + "");
    localStorage.setItem(StorageKeys.ReturnFormat, returnFormat + "");

    closeConfigModal();
  };

  return (
    <>
      <div className="flex gap-2 items-center ">
        <form
          className="flex flex-col md:flex-row py-2 px-2 gap-2 place-content-between border-b flex-1"
          onSubmit={onAPIEvent}
          noValidate
        >
          <div className="flex gap-3 items-center">
            <div>
              <svg
                height={30 || "106"}
                width={30 || "106"}
                viewBox="0 0 36 34"
                xmlSpace="preserve"
                xmlns="http://www.w3.org/2000/svg"
                className={
                  "fill-[rgb(98,203,82)] transition-all group-hover:scale-110"
                }
              >
                <title>Spider v1 Logo</title>
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M9.13883 7.06589V0.164429L13.0938 0.164429V6.175L14.5178 7.4346C15.577 6.68656 16.7337 6.27495 17.945 6.27495C19.1731 6.27495 20.3451 6.69807 21.4163 7.46593L22.8757 6.175V0.164429L26.8307 0.164429V7.06589V7.95679L26.1634 8.54706L24.0775 10.3922C24.3436 10.8108 24.5958 11.2563 24.8327 11.7262L26.0467 11.4215L28.6971 8.08749L31.793 10.5487L28.7257 14.407L28.3089 14.9313L27.6592 15.0944L26.2418 15.4502C26.3124 15.7082 26.3793 15.9701 26.4422 16.2355L28.653 16.6566L29.092 16.7402L29.4524 17.0045L35.3849 21.355L33.0461 24.5444L27.474 20.4581L27.0719 20.3816C27.1214 21.0613 27.147 21.7543 27.147 22.4577C27.147 22.5398 27.1466 22.6214 27.1459 22.7024L29.5889 23.7911L30.3219 24.1177L30.62 24.8629L33.6873 32.5312L30.0152 34L27.246 27.0769L26.7298 26.8469C25.5612 32.2432 22.0701 33.8808 17.945 33.8808C13.8382 33.8808 10.3598 32.2577 9.17593 26.9185L8.82034 27.0769L6.05109 34L2.37897 32.5312L5.44629 24.8629L5.74435 24.1177L6.47743 23.7911L8.74487 22.7806C8.74366 22.6739 8.74305 22.5663 8.74305 22.4577C8.74305 21.7616 8.76804 21.0758 8.81654 20.4028L8.52606 20.4581L2.95395 24.5444L0.615112 21.355L6.54761 17.0045L6.908 16.7402L7.34701 16.6566L9.44264 16.2575C9.50917 15.9756 9.5801 15.6978 9.65528 15.4242L8.34123 15.0944L7.69155 14.9313L7.27471 14.407L4.20739 10.5487L7.30328 8.08749L9.95376 11.4215L11.0697 11.7016C11.3115 11.2239 11.5692 10.7716 11.8412 10.3473L9.80612 8.54706L9.13883 7.95679V7.06589Z"
                ></path>
              </svg>
            </div>
            <div>
              <h1 className="text-xl">Spider Crawler VSCode</h1>
              <p className="text-sm">
                App made for{" "}
                <a
                  href="https://spider.cloud"
                  className="underline hover:text-blue-500"
                >
                  spider.cloud
                </a>
              </p>
            </div>
          </div>
          <div className="flex gap-3 items-center flex-wrap">
            <Badge variant="secondary" className="uppercase">
              Alpha
            </Badge>
            <Label htmlFor="search" className="sr-only">
              Search
            </Label>
            <div className="relative">
              <Input
                type="text"
                id="search"
                className="dark:text-black rounded border px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter website..."
                aria-label="Search"
                onChange={onChangeEvent}
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                {dataLoading ? (
                  <VscLoading className="motion-safe:animate-spin" />
                ) : (
                  <VscSearch />
                )}
              </div>
            </div>

            {auth?.$session ? (
              <Button
                type="button"
                variant={"ghost"}
                onClick={openConfigModal}
                className="hover:bg-gray-300 dark:hover:bg-gray-700 p-2 rounded text-sm uppercase flex items-center justify-center text-gray-700 dark:text-gray-300"
              >
                <span className="sr-only">Crawl Settings</span>
                <VscSettings className="w-7 h-7" />
              </Button>
            ) : null}
          </div>
        </form>
        <AuthDropdown {...auth} />
      </div>

      {configModalOpen && (
        <Dialog
          open={configModalOpen}
          onOpenChange={(e: boolean) => setConfigModalOpen(e)}
        >
          <DialogOverlay />
          <DialogContent className="p-4 bg-white rounded-md shadow-md">
            <DialogHeader>
              <DialogTitle>Configuration</DialogTitle>
              <DialogDescription>
                Set your configuration options for crawling.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3">
              <div className="flex items-center">
                <Label htmlFor="crawlLimit" className="flex-1">
                  Crawl Limit:
                </Label>
                <Input
                  type="number"
                  id="crawlLimit"
                  className="p-2 border w-1/2 border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={crawlLimit}
                  onChange={handleLimitChange}
                  min="1"
                  max="1000"
                />
              </div>
              <div className="flex items-center">
                <Label htmlFor="returnFormat" className="flex-1">
                  Return Format:
                </Label>

                <Select
                  onValueChange={handleFormatChange}
                  defaultValue={returnFormat}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Raw" id="returnFormat" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="raw">Raw</SelectItem>
                    <SelectItem value="markdown">Markdown</SelectItem>
                    <SelectItem value="text">Text</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center">
                <Label htmlFor="request" className="flex-1">
                  Request:
                </Label>

                <Select
                  onValueChange={handleReturnChange}
                  defaultValue={request}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="HTTP" id="request" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="chrome">Chrome</SelectItem>
                    <SelectItem value="smart">Smart Mode</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="button"
                onClick={saveConfigEvent}
                className="px-4 py-2 rounded self-end"
              >
                Save
              </Button>

              <div className="pt-20 pb-2 flex place-content-end border-t">
                <Button onClick={onLogoutEvent} variant={"destructive"}>
                  Logout
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default SearchBar;
